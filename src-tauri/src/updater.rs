//! アプリ内アップデート（tauri-plugin-updater）。
//!
//! 更新の有無は従来どおりレンダラーが GitHub Releases の API で調べ、更新ダイアログから
//! update_download が呼ばれる。ここでは latest.json（GitHub Releases の最新リリースに添付）を
//! 取得し、minisign 署名を検証したうえでダウンロード・インストールする。

use std::sync::Mutex;

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
use tokio::sync::oneshot;

const PROGRESS_EVENT: &str = "update:download-progress";

#[derive(Default)]
pub struct UpdateState {
    /// ダウンロード中なら、キャンセルを伝える送信側
    cancel: Mutex<Option<oneshot::Sender<()>>>,
}

/// preload の startUpdateDownload() と同じ形の結果。
#[derive(Serialize)]
pub struct UpdateResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn failed(error: impl ToString) -> UpdateResult {
    UpdateResult {
        success: false,
        error: Some(error.to_string()),
    }
}

pub fn cancel(app: &AppHandle) {
    if let Some(sender) = app.state::<UpdateState>().cancel.lock().unwrap().take() {
        let _ = sender.send(());
    }
}

pub async fn download_and_install(app: &AppHandle) -> UpdateResult {
    let (cancel_tx, cancel_rx) = oneshot::channel();
    {
        let state = app.state::<UpdateState>();
        let mut slot = state.cancel.lock().unwrap();
        if slot.is_some() {
            return failed("update is already in progress");
        }
        *slot = Some(cancel_tx);
    }
    let result = run(app, cancel_rx).await;
    app.state::<UpdateState>().cancel.lock().unwrap().take();
    result
}

async fn run(app: &AppHandle, cancel_rx: oneshot::Receiver<()>) -> UpdateResult {
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => return failed(error),
    };
    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => return failed("No update is available."),
        Err(error) => return failed(error),
    };
    log::info!("アップデートをダウンロードします: {}", update.version);

    let progress_app = app.clone();
    let mut received: u64 = 0;
    let mut last_percent: Option<u64> = None;
    let download = update.download(
        move |chunk_length, content_length| {
            received += chunk_length as u64;
            let total = content_length.unwrap_or(0);
            let percent = if total > 0 { received * 100 / total } else { 0 };
            // 毎チャンク送ると多すぎるので、% が変わったときだけ送る
            if last_percent != Some(percent) {
                last_percent = Some(percent);
                let _ = progress_app.emit_to(
                    crate::UI_WEBVIEW,
                    PROGRESS_EVENT,
                    json!({ "receivedBytes": received, "totalBytes": total, "percent": percent }),
                );
            }
        },
        || {},
    );

    // キャンセルされたらダウンロードの future を捨てて中断する
    let bytes = tokio::select! {
        result = download => match result {
            Ok(bytes) => bytes,
            Err(error) => return failed(error),
        },
        _ = cancel_rx => return failed("cancelled"),
    };

    // Windows はインストーラを起動するとプロセスがそのまま終了し、通常の終了処理
    // （状態の保存・ターミナルの後片付け）が走らないため、先に済ませておく
    crate::save_now(app);
    app.state::<crate::terminal::Terminals>().destroy_all();

    if let Err(error) = update.install(bytes) {
        return failed(error);
    }
    // macOS / Linux は入れ替えが終わったので新しい版を起動し直す（Windows はここに来ない）
    app.restart();
}
