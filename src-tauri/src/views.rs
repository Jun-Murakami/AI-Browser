//! AI サービスの子 WebView（Electron 版の WebContentsView に相当）。
//!
//! 全サービス分の WebView をメインウィンドウに重ねて置き、表示中のタブ以外は hide() する。
//! ミューテックスを持ったまま WebView のメソッドを呼ぶと、メインスレッドで動く
//! on_page_load と取り合ってデッドロックする恐れがあるため、必要な値を取り出して
//! ロックを外してから呼ぶ。

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Runtime, Webview, WebviewUrl,
    Window,
};
use url::Url;

use crate::Shared;

/// 子 WebView の上端（タブバーと URL バーの高さ）。Electron 版と同じ値。
const VIEW_TOP: f64 = 108.0;

/// Windows（WebView2）に渡す Chromium の引数。
/// 先頭は Tauri の既定値で、additional_browser_args を指定すると置き換わるため含めておく。
/// 残りは非表示タブのタイマー抑制を止めるためのもの（Electron 版の backgroundThrottling: false 相当）。
/// 同じ WebView2 環境を共有するため、UI と全サービスで同じ値を使う必要がある。
#[cfg(windows)]
const WEBVIEW2_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
--disable-background-timer-throttling --disable-renderer-backgrounding \
--disable-backgrounding-occluded-windows";

pub fn with_browser_args<R: Runtime>(builder: WebviewBuilder<R>) -> WebviewBuilder<R> {
    #[cfg(windows)]
    {
        builder.additional_browser_args(WEBVIEW2_ARGS)
    }
    #[cfg(not(windows))]
    {
        builder
    }
}

/// レンダラーから渡されるブラウザ定義（src/shared/constants/browsers.ts）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserDef {
    pub id: String,
    pub label: String,
    pub index: usize,
    pub url: String,
    pub url_patterns: Vec<String>,
}

impl BrowserDef {
    fn matches(&self, url: &str) -> bool {
        self.url_patterns.iter().any(|p| url.contains(p.as_str()))
    }
}

#[derive(Default)]
pub struct Views {
    pub defs: Vec<BrowserDef>,
    pub urls: Vec<String>,
    pub current_index: usize,
    pub is_terminal_active: bool,
    /// レンダラーが測ったブラウザ表示領域（幅・高さ）
    pub content_size: Option<(f64, f64)>,
    initial_load_done: Vec<bool>,
    created: bool,
}

impl Views {
    fn visible_index(&self) -> Option<usize> {
        (!self.is_terminal_active && self.current_index < self.defs.len())
            .then_some(self.current_index)
    }
}

pub fn view_label(id: &str) -> String {
    format!("svc-{id}")
}

/// 表示中タブの矩形（論理座標）。
/// レンダラーから表示領域の大きさが届く前は、保存済みの幅とウィンドウの高さから求める。
fn visible_rect<R: Runtime>(
    window: &Window<R>,
    content_size: Option<(f64, f64)>,
    browser_width: f64,
) -> Rect {
    let (width, height) = match content_size {
        Some((w, h)) => (w - 2.0, h - 8.0),
        None => {
            let inner = window
                .inner_size()
                .ok()
                .zip(window.scale_factor().ok())
                .map(|(size, scale)| size.to_logical::<f64>(scale));
            let win_height = inner.map(|s| s.height).unwrap_or(800.0);
            (browser_width - 2.0, win_height - VIEW_TOP - 8.0)
        }
    };
    Rect {
        position: LogicalPosition::new(0.0, VIEW_TOP).into(),
        size: LogicalSize::new(width.max(1.0), height.max(1.0)).into(),
    }
}

fn main_window<R: Runtime>(app: &AppHandle<R>) -> Option<Window<R>> {
    app.get_window(crate::MAIN_WINDOW)
}

fn service_webview<R: Runtime>(app: &AppHandle<R>, id: &str) -> Option<Webview<R>> {
    app.get_webview(&view_label(id))
}

/// 全サービスの子 WebView を作る。
/// 2 回目以降（開発中の UI のリロードなど）は作り直さず、定義を更新して表示を起動直後と
/// 同じ状態（先頭タブを表示）に戻す。リロード後の UI は先頭タブを選んだ状態で始まるため。
pub fn create_all<R: Runtime>(app: &AppHandle<R>, defs: Vec<BrowserDef>) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let window = main_window(app).ok_or("main window not found")?;
    let browser_width = shared.state.lock().unwrap().browser_width;

    let (content_size, current_index) = {
        let mut views = shared.views.lock().unwrap();
        if views.created {
            // WebView のラベルは ID から決まるため、ID の並びが同じときだけ定義を差し替える
            let same_ids = views.defs.len() == defs.len()
                && views.defs.iter().zip(&defs).all(|(a, b)| a.id == b.id);
            if same_ids {
                views.defs = defs;
            }
            views.current_index = 0;
            views.is_terminal_active = false;
            drop(views);
            return apply_visibility(app);
        }
        views.created = true;
        views.urls = defs.iter().map(|d| d.url.clone()).collect();
        views.initial_load_done = vec![false; defs.len()];
        views.defs = defs.clone();
        (views.content_size, views.current_index)
    };

    // 初期ロードは全タブを表示サイズで行う。極小サイズで読み込むと
    // Cloudflare などの判定が失敗することがあったため（Electron 版と同じ方針）。
    // 表示中以外のタブは初回ロード完了時に hide() する。
    let rect = visible_rect(&window, content_size, browser_width);
    // index はレンダラーの BROWSERS 配列での位置（タブ選択やローディング通知と揃える）
    for (index, def) in defs.iter().enumerate() {
        let url: Url = def.url.parse().map_err(|e| format!("{}: {e}", def.url))?;
        let builder = WebviewBuilder::new(view_label(&def.id), WebviewUrl::External(url))
            .on_page_load(move |webview, payload| {
                on_service_page_load(&webview, index, payload.event(), payload.url());
            })
            // OAuth のポップアップなどが動くよう、window.open は WebView の既定動作に任せる
            // （Electron 版も WebContentsView の window.open は既定動作だった）
            .on_new_window(|_url, _features| NewWindowResponse::Allow);
        window
            .add_child(with_browser_args(builder), rect.position, rect.size)
            .map_err(|e| format!("{}: {e}", def.id))?;
    }

    log::info!("子 WebView を {} 個作成しました", defs.len());

    // 生成中に別タブが選ばれていた場合に備えて表示を揃える
    if current_index != 0 {
        apply_visibility(app)?;
    }
    Ok(())
}

fn on_service_page_load<R: Runtime>(
    webview: &Webview<R>,
    index: usize,
    event: PageLoadEvent,
    url: &Url,
) {
    let app = webview.app_handle();
    let shared = app.state::<Shared>();
    let is_loading = matches!(event, PageLoadEvent::Started);
    let _ = app.emit_to(
        crate::UI_WEBVIEW,
        "loading-status",
        json!({ "index": index, "isLoading": is_loading }),
    );

    if !is_loading {
        log::info!(
            "読み込み完了: {} ({})",
            webview.label(),
            url.host_str().unwrap_or_default()
        );
    }

    let (urls, hide_now) = {
        let mut views = shared.views.lock().unwrap();
        if let Some(slot) = views.urls.get_mut(index) {
            *slot = url.to_string();
        }
        let mut hide_now = false;
        if !is_loading && !views.initial_load_done.get(index).copied().unwrap_or(true) {
            views.initial_load_done[index] = true;
            hide_now = views.visible_index() != Some(index);
        }
        (views.urls.clone(), hide_now)
    };
    let _ = app.emit_to(crate::UI_WEBVIEW, "update-urls", urls);
    if hide_now {
        let _ = webview.hide();
    }
    // Electron 版の Nani! の履歴を引き継ぐ（済んでいれば何もしない）
    if !is_loading && webview.label() == view_label("NANI") {
        crate::migrate::try_inject(app);
    }
}

/// 表示中のタブだけを表示し、他を隠す。
pub fn apply_visibility<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let window = main_window(app).ok_or("main window not found")?;
    let browser_width = shared.state.lock().unwrap().browser_width;
    let (ids, visible, content_size) = {
        let views = shared.views.lock().unwrap();
        let ids: Vec<String> = views.defs.iter().map(|d| d.id.clone()).collect();
        (ids, views.visible_index(), views.content_size)
    };

    let rect = visible_rect(&window, content_size, browser_width);
    for (i, id) in ids.iter().enumerate() {
        let Some(webview) = service_webview(app, id) else {
            continue;
        };
        if Some(i) == visible {
            webview.set_bounds(rect).map_err(|e| e.to_string())?;
            webview.show().map_err(|e| e.to_string())?;
        } else {
            webview.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// レンダラーから表示領域の大きさが届いたとき。表示中のタブだけサイズを合わせる。
pub fn resize_visible<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let window = main_window(app).ok_or("main window not found")?;
    shared.state.lock().unwrap().browser_width = width;
    let visible = {
        let mut views = shared.views.lock().unwrap();
        views.content_size = Some((width, height));
        views
            .visible_index()
            .and_then(|i| views.defs.get(i).map(|d| d.id.clone()))
    };
    if let Some(webview) = visible.and_then(|id| service_webview(app, &id)) {
        let rect = visible_rect(&window, Some((width, height)), width);
        webview.set_bounds(rect).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// タブ選択。index が負ならターミナルが選ばれた。
pub fn select<R: Runtime>(app: &AppHandle<R>, index: i64) -> Result<(), String> {
    let shared = app.state::<Shared>();
    {
        let mut views = shared.views.lock().unwrap();
        if index < 0 {
            views.is_terminal_active = true;
        } else {
            views.is_terminal_active = false;
            let index = index as usize;
            if index >= views.defs.len() {
                return Ok(());
            }
            views.current_index = index;
            shared.state.lock().unwrap().browser_tab_index = index as f64;
        }
    }
    apply_visibility(app)
}

/// スクリプト本体を try/catch で包み、例外メッセージを戻り値で返す。
/// Windows の eval_with_callback は例外を返さないため。
fn wrap_script(script: &str) -> String {
    format!(
        "(function(){{try{{\n{script}\n;return null;}}catch(e){{return String((e&&e.message)||e);}}}})()"
    )
}

/// テキスト送信。scripts はブラウザ ID ごとの組み立て済みスクリプト。
/// 送信先の判定は Electron 版と同じ（有効なタブのうち、一斉送信なら送信対象、
/// 単体送信なら表示中のタブで URL がサービスのものと一致する場合）。
pub fn send_text<R: Runtime>(
    app: &AppHandle<R>,
    scripts: std::collections::HashMap<String, String>,
    send_to_all: bool,
) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let (defs, current_index) = {
        let views = shared.views.lock().unwrap();
        (views.defs.clone(), views.current_index)
    };
    let (enabled, targets) = {
        let state = shared.state.lock().unwrap();
        (state.enabled_browsers.clone(), state.send_targets.clone())
    };

    for (i, def) in defs.iter().enumerate() {
        if enabled.get(&def.id) == Some(&false) {
            continue;
        }
        let Some(webview) = service_webview(app, &def.id) else {
            continue;
        };
        let current_url = webview.url().map(|u| u.to_string()).unwrap_or_default();
        let should_send = (send_to_all && targets.get(&def.id) != Some(&false))
            || (current_index == i && def.matches(&current_url));
        if !should_send {
            continue;
        }
        let Some(script) = scripts.get(&def.id) else {
            continue;
        };

        let app_for_error = app.clone();
        let label = def.label.clone();
        let result = webview.eval_with_callback(wrap_script(script), move |result: String| {
            if let Ok(Some(error)) = serde_json::from_str::<Option<String>>(&result) {
                let _ = app_for_error.emit_to(
                    crate::UI_WEBVIEW,
                    "script-error",
                    json!({ "browser": label, "error": error }),
                );
            }
        });
        if let Err(error) = result {
            let _ = app.emit_to(
                crate::UI_WEBVIEW,
                "script-error",
                json!({ "browser": def.label, "error": error.to_string() }),
            );
        }
    }
    Ok(())
}

/// 表示中のタブを再読み込みする。サービス外の URL にいる場合は何もしない（Electron 版と同じ）。
pub fn reload_current<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let def = {
        let views = shared.views.lock().unwrap();
        views.defs.get(views.current_index).cloned()
    };
    let Some(def) = def else { return Ok(()) };
    let Some(webview) = service_webview(app, &def.id) else {
        return Ok(());
    };
    let url = webview.url().map(|u| u.to_string()).unwrap_or_default();
    if def.matches(&url) {
        webview.reload().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 全タブを初期 URL に戻す。
pub fn reload_all<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let defs = shared.views.lock().unwrap().defs.clone();
    for def in defs {
        if let (Some(webview), Ok(url)) = (service_webview(app, &def.id), def.url.parse::<Url>()) {
            webview.navigate(url).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 表示中のタブにキーを送る。ターミナル表示中は何もしない（Electron 版と同じ）。
pub fn send_key<R: Runtime>(
    app: &AppHandle<R>,
    key_code: &str,
    modifiers: &[String],
) -> Result<(), String> {
    let shared = app.state::<Shared>();
    let id = {
        let views = shared.views.lock().unwrap();
        views
            .visible_index()
            .and_then(|i| views.defs.get(i).map(|d| d.id.clone()))
    };
    match id.and_then(|id| service_webview(app, &id)) {
        Some(webview) => crate::keys::dispatch(&webview, key_code, modifiers),
        None => Ok(()),
    }
}

pub fn current_urls<R: Runtime>(app: &AppHandle<R>) -> Vec<String> {
    app.state::<Shared>().views.lock().unwrap().urls.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrapped_script_returns_null_or_message() {
        let wrapped = wrap_script("var a = 1;");
        assert!(wrapped.starts_with("(function(){try{"));
        assert!(wrapped.contains("var a = 1;"));
        assert!(wrapped.ends_with("})()"));
    }

    #[test]
    fn matches_any_pattern() {
        let def = BrowserDef {
            id: "GROK".into(),
            label: "Grok".into(),
            index: 3,
            url: "https://grok.com/".into(),
            url_patterns: vec!["x.com".into(), "grok".into()],
        };
        assert!(def.matches("https://grok.com/chat"));
        assert!(def.matches("https://x.com/i/grok"));
        assert!(!def.matches("https://example.com/"));
    }
}
