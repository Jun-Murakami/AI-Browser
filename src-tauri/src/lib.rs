//! AI-Browser（Tauri 版）のエントリポイント。
//!
//! 構成は Electron 版と同じで、メインウィンドウの全面に React UI の WebView（"ui"）を置き、
//! その上に AI サービスごとの子 WebView（"svc-<ID>"）を重ねる（views.rs）。
//! IPC は capabilities/default.json で "ui" だけに許可している。

mod keys;
mod migrate;
mod state;
mod terminal;
mod updater;
mod views;

use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::window::WindowBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Theme, WebviewUrl, WindowEvent};
use tauri_plugin_opener::OpenerExt;
use url::Url;

pub const MAIN_WINDOW: &str = "main";
pub const UI_WEBVIEW: &str = "ui";

/// アプリ全体で共有する状態。
pub struct Shared {
    pub state: Mutex<state::AppState>,
    pub logs: Mutex<Vec<Value>>,
    pub views: Mutex<views::Views>,
    pub nani: Mutex<migrate::NaniMigration>,
    pub data_dir: PathBuf,
}

/// レンダラーから渡されるターミナル定義（src/shared/constants/terminals.ts）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDef {
    id: String,
    label: String,
    index: usize,
}

/// preload の getInitialSettings() と同じ形。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InitialSettings {
    current_version: String,
    is_dark_mode: bool,
    editor_mode: f64,
    browser_width: f64,
    logs: Vec<Value>,
    language: String,
    font_size: f64,
    os_info: &'static str,
    is_app_image: bool,
    enabled_browsers: BTreeMap<String, bool>,
    enabled_terminals: BTreeMap<String, bool>,
    browsers: Vec<Value>,
    terminals: Vec<Value>,
    tab_orders: BTreeMap<String, f64>,
    send_targets: BTreeMap<String, bool>,
    boilerplates: BTreeMap<String, String>,
    boilerplate_bank: String,
}

/// Electron の process.platform と同じ表記にする（レンダラーがこの値で分岐しているため）。
fn os_info() -> &'static str {
    if cfg!(windows) {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    }
}

fn theme(is_dark: bool) -> Theme {
    if is_dark {
        Theme::Dark
    } else {
        Theme::Light
    }
}

/// 外部ブラウザで開く。http / https / mailto 以外のスキームは開かない。
fn open_external_safe(app: &AppHandle, raw_url: &str) {
    match Url::parse(raw_url) {
        Ok(url) if matches!(url.scheme(), "http" | "https" | "mailto") => {
            if let Err(error) = app.opener().open_url(raw_url, None::<&str>) {
                log::warn!("外部リンクを開けませんでした: {error}");
            }
        }
        Ok(url) => log::warn!("許可されていないスキームのため開きません: {}", url.scheme()),
        Err(error) => log::warn!("不正な URL のため開きません: {error}"),
    }
}

/// UI の WebView に読み込んでよい URL か。
fn is_app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "data" | "blob" => true,
        "http" | "https" => match url.host_str() {
            Some("tauri.localhost") => true,
            Some("localhost") | Some("127.0.0.1") => tauri::is_dev(),
            _ => false,
        },
        _ => false,
    }
}

/// Electron 版の userData（appState.json / logs.json の引き継ぎ元）。
fn electron_user_data_dirs(app: &AppHandle) -> Vec<PathBuf> {
    let Ok(base) = app.path().config_dir() else {
        return Vec::new();
    };
    // 配布版は productName（AI-Browser）、開発時は package.json の name（ai-browser）。
    // 大文字小文字を区別するファイルシステムに備えて両方見る。
    vec![base.join("AI-Browser"), base.join("ai-browser")]
}

// ───────────────────────────────────────────────────────────
// コマンド
// WebView を触るコマンドは async にする。同期コマンドはメインスレッドで動くため、
// WebView の操作と組み合わせるとデッドロックすることがある。
// ───────────────────────────────────────────────────────────

/// 初期化。状態を現在の構成に合わせて検証し、子 WebView を作り、初期設定を返す。
#[tauri::command]
async fn init(
    app: AppHandle,
    browsers: Vec<views::BrowserDef>,
    terminals: Vec<TerminalDef>,
) -> Result<InitialSettings, String> {
    let shared = app.state::<Shared>();
    let browser_ids: Vec<String> = browsers.iter().map(|b| b.id.clone()).collect();
    let terminal_ids: Vec<String> = terminals.iter().map(|t| t.id.clone()).collect();
    let snapshot = {
        let mut state = shared.state.lock().unwrap();
        state.normalize(&browser_ids, &terminal_ids);
        state.clone()
    };
    let logs = shared.logs.lock().unwrap().clone();

    views::create_all(&app, browsers.clone())?;
    show_main_window(&app);
    migrate::offer_electron_uninstall(&app);

    Ok(InitialSettings {
        current_version: app.package_info().version.to_string(),
        is_dark_mode: snapshot.is_dark_mode,
        editor_mode: snapshot.editor_mode,
        browser_width: snapshot.browser_width,
        logs,
        language: snapshot.language,
        font_size: snapshot.font_size,
        os_info: os_info(),
        // AppImage 実行時のみ環境変数 APPIMAGE がセットされる
        is_app_image: std::env::var_os("APPIMAGE").is_some(),
        enabled_browsers: snapshot.enabled_browsers,
        enabled_terminals: snapshot.enabled_terminals,
        browsers: browsers
            .iter()
            .map(|b| json!({ "id": b.id, "label": b.label, "index": b.index, "url": b.url }))
            .collect(),
        terminals: terminals
            .iter()
            .map(|t| json!({ "id": t.id, "label": t.label, "index": t.index, "type": "terminal" }))
            .collect(),
        tab_orders: snapshot.tab_orders,
        send_targets: snapshot.send_targets,
        boilerplates: snapshot.boilerplates,
        boilerplate_bank: snapshot.boilerplate_bank,
    })
}

#[tauri::command]
async fn current_urls(app: AppHandle) -> Vec<String> {
    views::current_urls(&app)
}

#[tauri::command]
async fn set_browser_size(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if width <= 0.0 || height <= 0.0 {
        return Ok(());
    }
    // ブラウザ側ペインの幅を覚えておき、次回起動時に UI の初期幅にする（Electron 版と同じ）。
    // bridge.ts は init の完了後にしか送らないので、初期レイアウト前の仮の幅では上書きされない
    app.state::<Shared>().state.lock().unwrap().browser_width = width;
    views::resize_visible(&app, width, height)
}

#[tauri::command]
async fn select_browser_tab(app: AppHandle, index: i64) -> Result<(), String> {
    views::select(&app, index)
}

#[tauri::command]
async fn send_text(
    app: AppHandle,
    scripts: HashMap<String, String>,
    send_to_all: bool,
) -> Result<(), String> {
    views::send_text(&app, scripts, send_to_all)
}

#[tauri::command]
async fn reload_current_view(app: AppHandle) -> Result<(), String> {
    views::reload_current(&app)
}

#[tauri::command]
async fn reload_all_views(app: AppHandle) -> Result<(), String> {
    views::reload_all(&app)
}

#[tauri::command]
async fn send_key_to_view(
    app: AppHandle,
    key_code: String,
    modifiers: Vec<String>,
) -> Result<(), String> {
    views::send_key(&app, &key_code, &modifiers)
}

#[tauri::command]
async fn open_external_link(app: AppHandle, url: String) {
    open_external_safe(&app, &url);
}

#[tauri::command]
async fn update_state(app: AppHandle, patch: state::StatePatch) {
    let is_dark_mode = patch.is_dark_mode;
    app.state::<Shared>().state.lock().unwrap().apply(patch);
    if let (Some(is_dark), Some(window)) = (is_dark_mode, app.get_window(MAIN_WINDOW)) {
        let _ = window.set_theme(Some(theme(is_dark)));
    }
}

#[tauri::command]
async fn set_logs(app: AppHandle, logs: Vec<Value>) {
    *app.state::<Shared>().logs.lock().unwrap() = logs;
}

// ターミナル。入力の順序はレンダラー側で 1 件ずつ送ることで保っている

#[tauri::command]
async fn terminal_create(app: AppHandle, terminal_id: String) -> Result<(), String> {
    app.state::<terminal::Terminals>()
        .create(&app, &terminal_id)
}

#[tauri::command]
async fn terminal_destroy(app: AppHandle, terminal_id: String) {
    app.state::<terminal::Terminals>().destroy(&terminal_id);
}

#[tauri::command]
async fn terminal_reload(app: AppHandle, terminal_id: String) -> Result<(), String> {
    app.state::<terminal::Terminals>()
        .reload(&app, &terminal_id)
}

#[tauri::command]
async fn terminal_input(app: AppHandle, terminal_id: String, data: String) -> Result<(), String> {
    app.state::<terminal::Terminals>()
        .write(&terminal_id, &data)
}

#[tauri::command]
async fn terminal_resize(app: AppHandle, terminal_id: String, cols: u16, rows: u16) {
    app.state::<terminal::Terminals>()
        .resize(&terminal_id, cols, rows);
}

#[tauri::command]
async fn terminal_read_clipboard_image(app: AppHandle) -> terminal::ClipboardImage {
    terminal::read_clipboard_image(&app.state::<Shared>().data_dir)
}

// アプリ内アップデート

#[tauri::command]
async fn update_download(app: AppHandle) -> updater::UpdateResult {
    updater::download_and_install(&app).await
}

#[tauri::command]
async fn update_cancel(app: AppHandle) {
    updater::cancel(&app);
}

// ───────────────────────────────────────────────────────────
// ウィンドウ
// ───────────────────────────────────────────────────────────

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_window(MAIN_WINDOW) {
        if !window.is_visible().unwrap_or(true) {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub(crate) fn save_now(app: &AppHandle) {
    let shared = app.state::<Shared>();
    let state = shared.state.lock().unwrap().clone();
    let logs = shared.logs.lock().unwrap().clone();
    if let Err(error) = state::save(&shared.data_dir, &state, &logs) {
        log::error!("状態の保存に失敗しました: {error}");
    }
}

fn create_main_window(app: &AppHandle) -> tauri::Result<()> {
    let snapshot = app.state::<Shared>().state.lock().unwrap().clone();
    // ここで使う位置と大きさは、window-state プラグインに保存が無いとき（初回起動）の既定値。
    // appState.json の bounds（Electron 版から引き継いだ値）を使い、以後はプラグインが復元する
    let bounds = snapshot.bounds;

    let builder = WindowBuilder::new(app, MAIN_WINDOW)
        .title("AI-Browser")
        .inner_size(bounds.width, bounds.height)
        .min_inner_size(1000.0, 700.0)
        .position(bounds.x, bounds.y)
        .maximized(snapshot.is_maximized)
        .theme(Some(theme(snapshot.is_dark_mode)))
        // UI の読み込みが終わってから表示する（Electron 版の ready-to-show 相当）
        .visible(false);
    // macOS では Tauri の既定（TitleBarStyle::Visible）が FullSizeContentView を有効にし、
    // コンテンツ領域がタイトルバーの下まで広がる。UI の WebView は WKWebView が中身を
    // タイトルバーの高さだけ自動で下げるが、子 WebView（svc-*）はタイトルバーの上端から
    // 配置されるため、その分（macOS 27 では 32pt）上にずれる。
    // Transparent は FullSizeContentView を使わないので、コンテンツ領域がタイトルバーの下から始まり、
    // UI と子 WebView が同じ座標になる。
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(tauri::TitleBarStyle::Transparent);
    let window = builder.build()?;

    let nav_app = app.clone();
    let popup_app = app.clone();
    let ui = WebviewBuilder::new(UI_WEBVIEW, WebviewUrl::App("index.html".into()))
        .auto_resize()
        // ターミナルへの貼り付けで navigator.clipboard.readText() を確認なしで使えるようにする
        // （Electron 版は既定で許可されていた）
        .enable_clipboard_access()
        // UI 内のリンクで UI 自体が別ページに遷移しないよう、外部 URL は既定のブラウザで開く
        .on_navigation(move |url| {
            if is_app_url(url) {
                return true;
            }
            open_external_safe(&nav_app, url.as_str());
            false
        })
        .on_new_window(move |url, _features| {
            open_external_safe(&popup_app, url.as_str());
            NewWindowResponse::Deny
        })
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                show_main_window(webview.app_handle());
            }
        });

    window.add_child(
        views::with_browser_args(ui),
        LogicalPosition::new(0.0, 0.0),
        LogicalSize::new(bounds.width, bounds.height),
    )?;

    let event_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { .. } = event {
            save_now(&event_app);
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(terminal::Terminals::default())
        .manage(updater::UpdateState::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        // ウィンドウの位置・大きさ・最大化を物理座標で保存・復元する（ウィンドウ生成前に登録する）。
        // VISIBLE は外す: UI の読み込みが終わるまでウィンドウを隠しておき、show_main_window で表示するため
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();
            let data_dir = app.path().app_data_dir()?;
            let electron_dirs = electron_user_data_dirs(handle);
            let loaded = state::load(&data_dir, &electron_dirs);
            if let Some(path) = &loaded.state_source {
                log::info!("状態を読み込みました: {}", path.display());
            }
            if let Some(path) = &loaded.logs_source {
                log::info!("ログを読み込みました: {}", path.display());
            }
            app.manage(Shared {
                state: Mutex::new(loaded.state),
                logs: Mutex::new(loaded.logs),
                views: Mutex::new(views::Views::default()),
                nani: Mutex::new(migrate::NaniMigration::default()),
                data_dir,
            });
            create_main_window(handle)?;
            migrate::start(handle, electron_dirs);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init,
            current_urls,
            set_browser_size,
            select_browser_tab,
            send_text,
            reload_current_view,
            reload_all_views,
            send_key_to_view,
            open_external_link,
            update_state,
            set_logs,
            terminal_create,
            terminal_destroy,
            terminal_reload,
            terminal_input,
            terminal_resize,
            terminal_read_clipboard_image,
            update_download,
            update_cancel,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let tauri::RunEvent::Exit = event {
            // ターミナルのプロセスを残さない。クリップボード画像の一時ファイルも消す
            app.state::<terminal::Terminals>().destroy_all();
            if let Some(shared) = app.try_state::<Shared>() {
                terminal::cleanup_clipboard_images(&shared.data_dir);
            }
        }
    });
}
