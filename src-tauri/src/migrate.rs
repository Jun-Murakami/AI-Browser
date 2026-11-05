//! Electron 版からのデータ移行。
//!
//! Nani! は翻訳履歴をブラウザの localStorage に保存している。WebView のデータ領域は
//! Electron 版と別なので、Electron 版の Local Storage（Chromium の LevelDB）から
//! nani.now の履歴だけを読み出し、Tauri 版の Nani! のページへ書き込む。
//! appState.json / logs.json の引き継ぎは state.rs で行っている。

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use rusty_leveldb::LdbIterator;
use tauri::{AppHandle, Manager, Runtime};

use crate::Shared;

const NANI_ID: &str = "NANI";
const NANI_HOST: &str = "nani.now";
/// Chromium の localStorage のキーは "_<origin>\0<種別 1 バイト><キー>"
const NANI_KEY_PREFIX: &[u8] = b"_https://nani.now\x00";
/// 翻訳履歴のキー。ログイン情報らしき cuser は、Cookie を移せない以上古い情報が残るだけなので移さない
const HISTORY_KEY_PREFIX: &str = "dltbl:";

#[derive(Default)]
pub struct NaniMigration {
    /// Electron 版から読み出した履歴。None は読み込み前
    data: Option<BTreeMap<String, String>>,
    in_progress: bool,
}

/// Chromium の localStorage の文字列。先頭 1 バイトが 0 なら UTF-16LE、1 なら Latin-1。
fn decode_chromium_string(bytes: &[u8]) -> Option<String> {
    let (&kind, rest) = bytes.split_first()?;
    match kind {
        0 => {
            if rest.len() % 2 != 0 {
                return None;
            }
            let units: Vec<u16> = rest
                .chunks_exact(2)
                .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
                .collect();
            String::from_utf16(&units).ok()
        }
        1 => Some(rest.iter().map(|&b| b as char).collect()),
        _ => None,
    }
}

/// LevelDB のフォルダをコピーする。Electron 版が起動中でも読めるよう LOCK は除く。
/// LevelDB は開くときにログの再生などで書き込むため、元のフォルダは直接開かない。
fn copy_leveldb(src: &Path, dst: &Path) -> std::io::Result<()> {
    if dst.exists() {
        fs::remove_dir_all(dst)?;
    }
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        if entry.file_type()?.is_file() && entry.file_name() != "LOCK" {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

/// LevelDB から nani.now の履歴を読み出す。
fn read_from_leveldb(db_dir: &Path) -> Result<BTreeMap<String, String>, String> {
    let options = rusty_leveldb::Options {
        create_if_missing: false,
        ..Default::default()
    };
    let mut db = rusty_leveldb::DB::open(db_dir, options).map_err(|e| e.to_string())?;
    let mut iter = db.new_iter().map_err(|e| e.to_string())?;

    let mut history = BTreeMap::new();
    iter.seek(NANI_KEY_PREFIX);
    while iter.valid() {
        let Some((key, value)) = iter.current() else {
            break;
        };
        let Some(encoded_key) = key.strip_prefix(NANI_KEY_PREFIX) else {
            break;
        };
        if let (Some(key), Some(value)) = (
            decode_chromium_string(encoded_key),
            decode_chromium_string(&value),
        ) {
            if key.starts_with(HISTORY_KEY_PREFIX) {
                history.insert(key, value);
            }
        }
        if !iter.advance() {
            break;
        }
    }
    Ok(history)
}

/// Electron 版の userData から Nani! の履歴を読み出す。Local Storage が無ければ空。
pub fn read_nani_history(electron_dirs: &[PathBuf], work_dir: &Path) -> BTreeMap<String, String> {
    let Some(src) = electron_dirs
        .iter()
        .map(|dir| dir.join("Local Storage").join("leveldb"))
        .find(|dir| dir.is_dir())
    else {
        return BTreeMap::new();
    };

    let copy = work_dir.join("electron-local-storage");
    let result = copy_leveldb(&src, &copy)
        .map_err(|e| e.to_string())
        .and_then(|()| read_from_leveldb(&copy));
    let _ = fs::remove_dir_all(&copy);

    match result {
        Ok(history) => history,
        Err(error) => {
            log::warn!("Electron 版の Local Storage を読めませんでした: {error}");
            BTreeMap::new()
        }
    }
}

/// 起動時に呼ぶ。移行済みでなければ別スレッドで読み出し、読めたら書き込みを試みる。
pub fn start<R: Runtime>(app: &AppHandle<R>, electron_dirs: Vec<PathBuf>) {
    if app.state::<Shared>().state.lock().unwrap().nani_migrated {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let work_dir = std::env::temp_dir().join(format!("ai-browser-migrate-{}", std::process::id()));
        let history = read_nani_history(&electron_dirs, &work_dir);
        let _ = fs::remove_dir_all(&work_dir);
        log::info!("Electron 版の Nani! の履歴: {} 件", history.len());
        app.state::<Shared>().nani.lock().unwrap().data = Some(history);
        try_inject(&app);
    });
}

fn mark_done<R: Runtime>(app: &AppHandle<R>) {
    let shared = app.state::<Shared>();
    shared.state.lock().unwrap().nani_migrated = true;
    let mut nani = shared.nani.lock().unwrap();
    nani.in_progress = false;
    nani.data = Some(BTreeMap::new());
}

/// 未設定のキーだけ書き込み、書き込んだ件数を返すスクリプト。
fn injection_script(history: &BTreeMap<String, String>) -> String {
    let data = serde_json::to_string(history).unwrap_or_else(|_| "{}".into());
    format!(
        "(function(){{var d={data};var n=0;for(var k in d){{\
         if(localStorage.getItem(k)===null){{localStorage.setItem(k,d[k]);n++;}}}}return n;}})()"
    )
}

/// Nani! のページが開いていて履歴の読み出しが済んでいれば、localStorage に書き込む。
/// 読み出しの完了時と、Nani! のページの読み込み完了時の両方から呼ばれる。
pub fn try_inject<R: Runtime>(app: &AppHandle<R>) {
    let shared = app.state::<Shared>();
    if shared.state.lock().unwrap().nani_migrated {
        return;
    }
    let script = {
        let mut nani = shared.nani.lock().unwrap();
        if nani.in_progress {
            return;
        }
        let script = match &nani.data {
            None => return,
            Some(history) if history.is_empty() => None,
            Some(history) => Some(injection_script(history)),
        };
        nani.in_progress = script.is_some();
        script
    };
    let Some(script) = script else {
        // 移す履歴が無い
        mark_done(app);
        return;
    };

    let webview = app
        .get_webview(&crate::views::view_label(NANI_ID))
        .filter(|webview| {
            webview
                .url()
                .is_ok_and(|url| url.host_str() == Some(NANI_HOST))
        });
    let Some(webview) = webview else {
        shared.nani.lock().unwrap().in_progress = false;
        return;
    };

    let callback_app = app.clone();
    let callback_webview = webview.clone();
    let result = webview.eval_with_callback(script, move |result: String| {
        let written = serde_json::from_str::<u64>(&result).unwrap_or(0);
        log::info!("Nani! の履歴を {written} 件書き込みました");
        mark_done(&callback_app);
        // Nani! は起動時に localStorage を読むので、書き込んだら読み込み直す
        if written > 0 {
            let _ = callback_webview.reload();
        }
    });
    if let Err(error) = result {
        log::warn!("Nani! への履歴の書き込みに失敗しました: {error}");
        shared.nani.lock().unwrap().in_progress = false;
    }
}

/// 旧 Electron 版のアンインストーラ（ユーザー単位の NSIS インストール）。
#[cfg(windows)]
fn electron_uninstaller() -> Option<PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    let path = PathBuf::from(local)
        .join("Programs")
        .join("ai-browser")
        .join("Uninstall AI-Browser.exe");
    path.is_file().then_some(path)
}

/// Windows: 旧 Electron 版が残っていれば、アンインストールするか 1 度だけ尋ねる。
///
/// Tauri 版の MSI はマシン単位、Electron 版はユーザー単位の NSIS なので、更新しても両方が残る。
/// 設定・ログ・Nani! の履歴は Electron 版の userData から読んでおり、アンインストーラは
/// userData を消さない（electron-builder の既定）ので、消しても引き継ぎには影響しない。
/// 開発ビルドでは尋ねない（普段使いの Electron 版を消してしまわないように）。
#[cfg(windows)]
pub fn offer_electron_uninstall<R: Runtime>(app: &AppHandle<R>) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    if tauri::is_dev() {
        return;
    }
    let shared = app.state::<Shared>();
    if shared.state.lock().unwrap().electron_uninstall_asked {
        return;
    }
    let Some(uninstaller) = electron_uninstaller() else {
        return;
    };
    shared.state.lock().unwrap().electron_uninstall_asked = true;

    app.dialog()
        .message(
            "An older version of AI-Browser (Electron) is still installed.\n\n\
             Your settings, prompt logs and Nani! history have been carried over to this version.\n\
             Uninstall the older version now?",
        )
        .title("AI-Browser")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Uninstall".into(),
            "Keep".into(),
        ))
        .show(move |accepted| {
            if !accepted {
                return;
            }
            // /S: サイレントアンインストール。旧版が起動中なら、アンインストーラが
            // インストール先のパスで見つけて終了させる（この Tauri 版は別の場所にあるので対象外）
            match std::process::Command::new(&uninstaller).arg("/S").spawn() {
                Ok(_) => log::info!("旧 Electron 版のアンインストーラを起動しました"),
                Err(error) => log::warn!("旧 Electron 版のアンインストーラを起動できませんでした: {error}"),
            }
        });
}

#[cfg(not(windows))]
pub fn offer_electron_uninstall<R: Runtime>(_app: &AppHandle<R>) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_both_chromium_encodings() {
        assert_eq!(decode_chromium_string(b"\x01abc").as_deref(), Some("abc"));
        let utf16: Vec<u8> = std::iter::once(0u8)
            .chain("履歴".encode_utf16().flat_map(|u| u.to_le_bytes()))
            .collect();
        assert_eq!(decode_chromium_string(&utf16).as_deref(), Some("履歴"));
        assert_eq!(decode_chromium_string(b"\x02x"), None);
        assert_eq!(decode_chromium_string(b""), None);
    }

    #[test]
    fn reads_only_nani_history_from_leveldb() {
        let dir = std::env::temp_dir().join(format!("aib-leveldb-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        {
            let mut db = rusty_leveldb::DB::open(&dir, rusty_leveldb::Options::default()).unwrap();
            db.put(b"_https://nani.now\x00\x01dltbl:hi:basic:tr-1", b"\x01{\"a\":1}")
                .unwrap();
            db.put(b"_https://nani.now\x00\x01cuser", b"\x01secret").unwrap();
            db.put(b"_https://other.example\x00\x01dltbl:x", b"\x01no").unwrap();
            db.flush().unwrap();
        }
        let history = read_from_leveldb(&dir).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(
            history.get("dltbl:hi:basic:tr-1").map(String::as_str),
            Some("{\"a\":1}")
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn injection_script_only_sets_missing_keys() {
        let mut history = BTreeMap::new();
        history.insert("dltbl:a".to_string(), "x\"y".to_string());
        let script = injection_script(&history);
        assert!(script.contains(r#"{"dltbl:a":"x\"y"}"#));
        assert!(script.contains("localStorage.getItem(k)===null"));
    }
}
