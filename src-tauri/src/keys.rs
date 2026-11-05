//! 表示中の AI サービスへのキー送出（Electron 版の webContents.sendInputEvent 相当）。
//!
//! 用途はテキスト送信直後の Enter と、Ctrl+Alt+矢印などのホットキー。
//! - Windows: WebView2 の DevTools Protocol（Input.dispatchKeyEvent）で送る。
//!   ページからは実際のキー入力と区別できない（isTrusted = true）。
//! - macOS / Linux: 暫定で JS の KeyboardEvent を送る。keydown を見ているサイトの
//!   Enter 送信などは動くが、キャレット移動のような既定動作は起きない（Phase 7 で検討）。

use serde_json::{json, Value};
use tauri::{Runtime, Webview};

/// CDP の modifiers ビット
const ALT: u32 = 1;
const CTRL: u32 = 2;
const META: u32 = 4;
const SHIFT: u32 = 8;

#[derive(Debug, PartialEq)]
pub struct KeySpec {
    key: String,
    code: String,
    /// Windows の仮想キーコード
    key_code: u32,
    /// 文字を入力するキー（Enter）の入力文字
    text: Option<&'static str>,
}

/// Electron の keyCode 表記（'Up', 'Return', 'A' など）を DOM のキー情報に変換する。
pub fn key_spec(key_code: &str) -> Option<KeySpec> {
    let named = |key: &str, key_code: u32, text: Option<&'static str>| KeySpec {
        key: key.into(),
        code: key.into(),
        key_code,
        text,
    };
    let spec = match key_code {
        "Up" | "ArrowUp" => named("ArrowUp", 38, None),
        "Down" | "ArrowDown" => named("ArrowDown", 40, None),
        "Left" | "ArrowLeft" => named("ArrowLeft", 37, None),
        "Right" | "ArrowRight" => named("ArrowRight", 39, None),
        "Return" | "Enter" => named("Enter", 13, Some("\r")),
        "Backspace" => named("Backspace", 8, None),
        "Tab" => named("Tab", 9, None),
        "Escape" | "Esc" => named("Escape", 27, None),
        "Delete" => named("Delete", 46, None),
        single if single.chars().count() == 1 => {
            let c = single.chars().next()?;
            if c.is_ascii_alphabetic() {
                let upper = c.to_ascii_uppercase();
                KeySpec {
                    key: c.to_ascii_lowercase().to_string(),
                    code: format!("Key{upper}"),
                    key_code: upper as u32,
                    text: None,
                }
            } else if c.is_ascii_digit() {
                KeySpec {
                    key: c.to_string(),
                    code: format!("Digit{c}"),
                    key_code: c as u32,
                    text: None,
                }
            } else {
                return None;
            }
        }
        _ => return None,
    };
    Some(spec)
}

/// Electron の modifiers 表記（'control', 'shift' など）を CDP のビットに変換する。
pub fn modifier_mask(modifiers: &[String]) -> u32 {
    modifiers.iter().fold(0, |mask, m| {
        mask | match m.to_ascii_lowercase().as_str() {
            "alt" => ALT,
            "control" | "ctrl" => CTRL,
            "meta" | "cmd" | "command" => META,
            "shift" => SHIFT,
            _ => 0,
        }
    })
}

/// Input.dispatchKeyEvent のパラメータ（押下と離上の 2 つ）。
pub fn cdp_events(spec: &KeySpec, modifiers: u32) -> Vec<Value> {
    let base = json!({
        "key": spec.key,
        "code": spec.code,
        "windowsVirtualKeyCode": spec.key_code,
        "nativeVirtualKeyCode": spec.key_code,
        "modifiers": modifiers,
    });
    let mut down = base.clone();
    // Ctrl / Alt / Meta と一緒なら文字は入力しない
    match spec.text {
        Some(text) if modifiers & (CTRL | ALT | META) == 0 => {
            down["type"] = "keyDown".into();
            down["text"] = text.into();
            down["unmodifiedText"] = text.into();
        }
        _ => down["type"] = "rawKeyDown".into(),
    }
    let mut up = base;
    up["type"] = "keyUp".into();
    vec![down, up]
}

#[cfg(windows)]
pub fn dispatch<R: Runtime>(
    webview: &Webview<R>,
    key_code: &str,
    modifiers: &[String],
) -> Result<(), String> {
    let spec = key_spec(key_code).ok_or_else(|| format!("unsupported key: {key_code}"))?;
    let events: Vec<String> = cdp_events(&spec, modifier_mask(modifiers))
        .iter()
        .map(Value::to_string)
        .collect();

    webview
        .with_webview(move |platform| {
            // SAFETY: WebView2 の COM 呼び出し。with_webview によりメインスレッドで実行される
            unsafe {
                let Ok(core) = platform.controller().CoreWebView2() else {
                    return;
                };
                let method = windows_core::HSTRING::from("Input.dispatchKeyEvent");
                for params in events {
                    let params = windows_core::HSTRING::from(params.as_str());
                    let handler =
                        webview2_com::CallDevToolsProtocolMethodCompletedHandler::create(
                            Box::new(|_, _| Ok(())),
                        );
                    if let Err(error) = core.CallDevToolsProtocolMethod(&method, &params, &handler)
                    {
                        log::warn!("キー送出に失敗しました: {error}");
                    }
                }
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
pub fn dispatch<R: Runtime>(
    webview: &Webview<R>,
    key_code: &str,
    modifiers: &[String],
) -> Result<(), String> {
    let spec = key_spec(key_code).ok_or_else(|| format!("unsupported key: {key_code}"))?;
    let mask = modifier_mask(modifiers);
    let init = json!({
        "key": spec.key,
        "code": spec.code,
        "keyCode": spec.key_code,
        "which": spec.key_code,
        "bubbles": true,
        "cancelable": true,
        "altKey": mask & ALT != 0,
        "ctrlKey": mask & CTRL != 0,
        "metaKey": mask & META != 0,
        "shiftKey": mask & SHIFT != 0,
    });
    let script = format!(
        "(function(){{var t=document.activeElement||document.body;var o={init};\
         t.dispatchEvent(new KeyboardEvent('keydown',o));\
         t.dispatchEvent(new KeyboardEvent('keyup',o));}})()"
    );
    webview.eval(script).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_electron_key_names() {
        assert_eq!(key_spec("Up").unwrap().key, "ArrowUp");
        assert_eq!(key_spec("Return").unwrap().text, Some("\r"));
        let a = key_spec("A").unwrap();
        assert_eq!((a.key.as_str(), a.code.as_str(), a.key_code), ("a", "KeyA", 65));
        assert!(key_spec("F13").is_none());
    }

    #[test]
    fn enter_types_text_only_without_ctrl() {
        let enter = key_spec("Return").unwrap();
        let plain = cdp_events(&enter, 0);
        assert_eq!(plain[0]["type"], "keyDown");
        assert_eq!(plain[0]["text"], "\r");
        assert_eq!(plain[1]["type"], "keyUp");

        let with_ctrl = cdp_events(&enter, modifier_mask(&["control".into()]));
        assert_eq!(with_ctrl[0]["type"], "rawKeyDown");
        assert!(with_ctrl[0].get("text").is_none());
        assert_eq!(with_ctrl[0]["modifiers"], 2);
    }
}
