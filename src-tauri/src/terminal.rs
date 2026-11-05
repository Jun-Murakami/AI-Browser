//! ターミナル（Electron 版の src/main/terminal/terminalManager.ts に相当）。
//!
//! セッションごとに 3 本のスレッドを使う。
//! - 読み取り: PTY の出力を UTF-8 として読み、チャンネルへ流す
//! - 送出: 16ms 分まとめて UI へ "terminal:output" イベントで送る（Electron 版と同じ間隔）
//! - 終了待ち: 子プロセスの終了を待ち、自然終了なら終了メッセージを出す
//!
//! リロードで同じ ID のセッションが作り直されても、古いプロセスの終了処理が
//! 新しいセッションを壊さないよう、世代番号で区別する。

use std::collections::HashMap;
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, Runtime};

const FLUSH_INTERVAL: Duration = Duration::from_millis(16);
const OUTPUT_EVENT: &str = "terminal:output";
const CLIPBOARD_DIR: &str = "Clipboard";

struct Session {
    generation: u64,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct Terminals {
    sessions: Mutex<HashMap<String, Session>>,
    next_generation: AtomicU64,
}

fn to_message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

impl Terminals {
    /// セッションを作る。同じ ID のセッションが既にあれば何もしない。
    pub fn create<R: Runtime>(&self, app: &AppHandle<R>, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if sessions.contains_key(id) {
            return Ok(());
        }

        let shell = default_shell();
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 30,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(to_message)?;

        let mut command = CommandBuilder::new(&shell);
        for arg in shell_args(&shell) {
            command.arg(arg);
        }
        if let Some(cwd) = home_dir() {
            command.cwd(cwd);
        }
        for (key, value) in extra_env() {
            command.env(key, value);
        }

        let mut child = pair.slave.spawn_command(command).map_err(to_message)?;
        // 子プロセスの終了時に読み取りが EOF になるよう、こちら側のスレーブは閉じておく
        drop(pair.slave);
        let reader = pair.master.try_clone_reader().map_err(to_message)?;
        let writer = pair.master.take_writer().map_err(to_message)?;
        let killer = child.clone_killer();
        let generation = self.next_generation.fetch_add(1, Ordering::Relaxed);
        sessions.insert(
            id.to_string(),
            Session {
                generation,
                master: pair.master,
                writer,
                killer,
            },
        );
        drop(sessions);

        let (data_tx, data_rx) = mpsc::channel::<String>();
        let (exit_tx, exit_rx) = mpsc::channel::<Option<String>>();

        thread::spawn(move || read_loop(reader, data_tx));

        let emit_app = app.clone();
        let emit_id = id.to_string();
        thread::spawn(move || emit_loop(&emit_app, &emit_id, data_rx, exit_rx));

        let wait_app = app.clone();
        let wait_id = id.to_string();
        thread::spawn(move || {
            let message = match child.wait() {
                Ok(status) => match status.signal() {
                    Some(signal) => format!("\r\nProcess terminated with signal {signal}\r\n"),
                    None => format!("\r\nProcess exited with code {}\r\n", status.exit_code()),
                },
                Err(error) => format!("\r\nProcess exited ({error})\r\n"),
            };
            // まだ現行のセッションなら自然終了。セッションを外すと PTY が閉じ、
            // 読み取りスレッドが EOF になって残りの出力が送られる（Windows の ConPTY は
            // 子プロセスが終わっても PTY を閉じるまで EOF にならない）。
            // 破棄・リロード済みなら終了メッセージは出さない（Electron 版と同じ）。
            let is_natural_exit = wait_app
                .state::<Terminals>()
                .take_if_generation(&wait_id, generation)
                .is_some();
            let _ = exit_tx.send(is_natural_exit.then_some(message));
        });

        // cmd.exe のときだけ UTF-8 に切り替えて画面を消す（Electron 版と同じ）
        if is_cmd(&shell) {
            let init_app = app.clone();
            let init_id = id.to_string();
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(200));
                let _ = init_app
                    .state::<Terminals>()
                    .write(&init_id, "chcp 65001\r\ncls\r\n");
            });
        }
        Ok(())
    }

    fn take_if_generation(&self, id: &str, generation: u64) -> Option<Session> {
        let mut sessions = self.sessions.lock().unwrap();
        if sessions.get(id).is_some_and(|s| s.generation == generation) {
            sessions.remove(id)
        } else {
            None
        }
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let Some(session) = sessions.get_mut(id) else {
            return Ok(());
        };
        session
            .writer
            .write_all(data.as_bytes())
            .and_then(|_| session.writer.flush())
            .map_err(to_message)
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) {
        if cols == 0 || rows == 0 {
            return;
        }
        if let Some(session) = self.sessions.lock().unwrap().get(id) {
            // リサイズ中の一時的な失敗は無視する
            let _ = session.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            });
        }
    }

    pub fn destroy(&self, id: &str) {
        let session = self.sessions.lock().unwrap().remove(id);
        if let Some(mut session) = session {
            let _ = session.killer.kill();
        }
    }

    /// プロセスを作り直す。
    /// Electron 版はセッションが無いと何もしなかったため、exit で終了したターミナルを
    /// リロードで起動し直せなかった。UI がリロードを呼ぶのは開いているターミナルだけなので、
    /// 無ければ作るようにしている。
    pub fn reload<R: Runtime>(&self, app: &AppHandle<R>, id: &str) -> Result<(), String> {
        self.destroy(id);
        self.create(app, id)
    }

    pub fn destroy_all(&self) {
        let sessions: Vec<Session> = self
            .sessions
            .lock()
            .unwrap()
            .drain()
            .map(|(_, session)| session)
            .collect();
        for mut session in sessions {
            let _ = session.killer.kill();
        }
    }
}

fn read_loop(mut reader: Box<dyn Read + Send>, tx: Sender<String>) {
    let mut buffer = [0u8; 8192];
    let mut pending = Vec::new();
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => {
                pending.extend_from_slice(&buffer[..n]);
                let text = take_utf8(&mut pending);
                if !text.is_empty() && tx.send(text).is_err() {
                    return;
                }
            }
            Err(error) if error.kind() == ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    if !pending.is_empty() {
        let _ = tx.send(String::from_utf8_lossy(&pending).into_owned());
    }
}

/// 先頭から UTF-8 として読める分を取り出す。末尾で途中まで届いた文字は次回に持ち越し、
/// 不正なバイトは置換文字にする。
fn take_utf8(pending: &mut Vec<u8>) -> String {
    let mut out = String::new();
    loop {
        match std::str::from_utf8(pending) {
            Ok(text) => {
                out.push_str(text);
                pending.clear();
                return out;
            }
            Err(error) => {
                let valid = error.valid_up_to();
                // valid_up_to までは UTF-8 として正しいことが保証されている
                out.push_str(std::str::from_utf8(&pending[..valid]).unwrap_or_default());
                match error.error_len() {
                    None => {
                        pending.drain(..valid);
                        return out;
                    }
                    Some(len) => {
                        out.push(char::REPLACEMENT_CHARACTER);
                        pending.drain(..valid + len);
                    }
                }
            }
        }
    }
}

fn emit_output<R: Runtime>(app: &AppHandle<R>, id: &str, data: &str) {
    let _ = app.emit_to(
        crate::UI_WEBVIEW,
        OUTPUT_EVENT,
        json!({ "terminalId": id, "data": data }),
    );
}

fn emit_loop<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    data_rx: Receiver<String>,
    exit_rx: Receiver<Option<String>>,
) {
    // 最初の出力が届いたら、そこから 16ms 分をまとめて送る
    while let Ok(first) = data_rx.recv() {
        let mut buffer = first;
        let deadline = Instant::now() + FLUSH_INTERVAL;
        let mut finished = false;
        loop {
            let now = Instant::now();
            if now >= deadline {
                break;
            }
            match data_rx.recv_timeout(deadline - now) {
                Ok(more) => buffer.push_str(&more),
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    finished = true;
                    break;
                }
            }
        }
        emit_output(app, id, &buffer);
        if finished {
            break;
        }
    }
    // 出力を送り切ってから終了メッセージを出す
    if let Ok(Some(message)) = exit_rx.recv() {
        emit_output(app, id, &message);
    }
}

// ───────────────────────────────────────────────────────────
// シェルと環境
// ───────────────────────────────────────────────────────────

#[cfg(windows)]
fn find_in_path(name: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.to_string_lossy().into_owned())
}

/// Windows: PowerShell 7 → Windows PowerShell → 既知のパス → cmd.exe の順に探す。
/// macOS / Linux: $SHELL（無ければ zsh / bash）。
fn default_shell() -> String {
    #[cfg(windows)]
    {
        if let Some(path) = find_in_path("pwsh.exe").or_else(|| find_in_path("powershell.exe")) {
            return path;
        }
        let known = [
            r"C:\Program Files\PowerShell\7\pwsh.exe",
            r"C:\Program Files (x86)\PowerShell\7\pwsh.exe",
            r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
        ];
        if let Some(path) = known.iter().find(|p| Path::new(p).is_file()) {
            return path.to_string();
        }
        std::env::var("COMSPEC").unwrap_or_else(|_| r"C:\Windows\System32\cmd.exe".into())
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
    }
}

fn shell_file_name(shell: &str) -> String {
    Path::new(shell)
        .file_name()
        .map(|name| name.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn is_cmd(shell: &str) -> bool {
    cfg!(windows) && shell_file_name(shell) == "cmd.exe"
}

fn shell_args(shell: &str) -> Vec<&'static str> {
    let name = shell_file_name(shell);
    if name.contains("powershell") || name.contains("pwsh") {
        // ロゴを表示しない
        vec!["-NoLogo"]
    } else if cfg!(windows) {
        Vec::new()
    } else {
        // GUI から起動すると OS の最小 PATH しか継承されないため、ログインシェルにして
        // ~/.profile などで追加される PATH（~/.local/bin など）を読み込む
        vec!["-l"]
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())
}

fn extra_env() -> Vec<(&'static str, &'static str)> {
    let mut env = vec![("TERM", "xterm-256color"), ("COLORTERM", "truecolor")];
    if cfg!(windows) {
        // 日本語の文字化け対策
        env.extend([
            ("LANG", "ja_JP.UTF-8"),
            ("CHCP", "65001"),
            ("POWERSHELL_TELEMETRY_OPTOUT", "1"),
        ]);
    }
    env
}

// ───────────────────────────────────────────────────────────
// クリップボード画像
// ───────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardImage {
    has_image: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl ClipboardImage {
    fn none() -> Self {
        Self {
            has_image: false,
            file_path: None,
            error: None,
        }
    }

    fn failed(error: impl std::fmt::Display) -> Self {
        Self {
            has_image: false,
            file_path: None,
            error: Some(error.to_string()),
        }
    }
}

/// クリップボードの画像を PNG で一時保存してパスを返す。
/// ターミナルに画像のパスを貼り付けるためのもの（Claude Code などに画像を渡す用途）。
pub fn read_clipboard_image(data_dir: &Path) -> ClipboardImage {
    let image = match arboard::Clipboard::new().and_then(|mut c| c.get_image()) {
        Ok(image) => image,
        Err(arboard::Error::ContentNotAvailable) => return ClipboardImage::none(),
        Err(error) => return ClipboardImage::failed(error),
    };
    if image.width == 0 || image.height == 0 {
        return ClipboardImage::none();
    }

    let dir = data_dir.join(CLIPBOARD_DIR);
    if let Err(error) = std::fs::create_dir_all(&dir) {
        return ClipboardImage::failed(error);
    }
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();
    let path = dir.join(format!("{millis}.png"));

    match write_png(&path, image.width as u32, image.height as u32, &image.bytes) {
        Ok(()) => ClipboardImage {
            has_image: true,
            file_path: Some(path.to_string_lossy().into_owned()),
            error: None,
        },
        Err(error) => ClipboardImage::failed(error),
    }
}

fn write_png(path: &Path, width: u32, height: u32, rgba: &[u8]) -> Result<(), String> {
    let file = std::fs::File::create(path).map_err(to_message)?;
    let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(to_message)?;
    writer.write_image_data(rgba).map_err(to_message)
}

/// 終了時にクリップボード画像の一時フォルダを消す。
pub fn cleanup_clipboard_images(data_dir: &Path) {
    let _ = std::fs::remove_dir_all(data_dir.join(CLIPBOARD_DIR));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_utf8_keeps_incomplete_tail() {
        let bytes = "あい".as_bytes();
        let mut pending = bytes[..4].to_vec(); // 「あ」と「い」の先頭 1 バイト
        assert_eq!(take_utf8(&mut pending), "あ");
        assert_eq!(pending.len(), 1);
        pending.extend_from_slice(&bytes[4..]);
        assert_eq!(take_utf8(&mut pending), "い");
        assert!(pending.is_empty());
    }

    #[test]
    fn take_utf8_replaces_invalid_bytes() {
        let mut pending = vec![b'a', 0xff, b'b'];
        assert_eq!(take_utf8(&mut pending), "a\u{FFFD}b");
        assert!(pending.is_empty());
    }

    #[test]
    fn shell_args_follow_electron_rules() {
        assert_eq!(
            shell_args(r"C:\Program Files\PowerShell\7\pwsh.exe"),
            vec!["-NoLogo"]
        );
        if cfg!(windows) {
            assert!(shell_args(r"C:\Windows\System32\cmd.exe").is_empty());
            assert!(is_cmd(r"C:\Windows\System32\cmd.exe"));
        } else {
            assert_eq!(shell_args("/bin/zsh"), vec!["-l"]);
        }
    }

    #[test]
    fn png_round_trip_writes_file() {
        let dir = std::env::temp_dir().join(format!("aib-png-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("x.png");
        write_png(&path, 2, 1, &[255, 0, 0, 255, 0, 255, 0, 255]).unwrap();
        let bytes = std::fs::read(&path).unwrap();
        assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
