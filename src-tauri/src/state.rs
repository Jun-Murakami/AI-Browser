//! アプリ状態（appState.json）とログ（logs.json）の読み書き。
//!
//! 形式は Electron 版と同じ JSON にしている。Tauri 側にファイルが無い初回起動時は、
//! Electron 版の userData から読み込んで引き継ぐ。

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

const STATE_FILE: &str = "appState.json";
const LOGS_FILE: &str = "logs.json";
const BOILERPLATE_BANKS: [&str; 5] = ["A", "B", "C", "D", "E"];

/// 値の型が想定と違っても、そのフィールドだけ既定値にして読み込みを続ける。
/// 1 項目の不整合で全設定が初期化されるのを防ぐため。
fn lenient<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: DeserializeOwned + Default,
{
    let value = Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Default for Bounds {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width: 1100.0,
            height: 800.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppState {
    #[serde(deserialize_with = "lenient")]
    pub bounds: Bounds,
    #[serde(deserialize_with = "lenient")]
    pub is_maximized: bool,
    #[serde(deserialize_with = "lenient")]
    pub is_dark_mode: bool,
    #[serde(deserialize_with = "lenient")]
    pub editor_mode: f64,
    #[serde(deserialize_with = "lenient")]
    pub browser_width: f64,
    #[serde(deserialize_with = "lenient")]
    pub browser_tab_index: f64,
    #[serde(deserialize_with = "lenient")]
    pub language: String,
    #[serde(deserialize_with = "lenient")]
    pub font_size: f64,
    #[serde(deserialize_with = "lenient")]
    pub enabled_browsers: BTreeMap<String, bool>,
    #[serde(deserialize_with = "lenient")]
    pub enabled_terminals: BTreeMap<String, bool>,
    #[serde(deserialize_with = "lenient")]
    pub tab_orders: BTreeMap<String, f64>,
    #[serde(deserialize_with = "lenient")]
    pub send_targets: BTreeMap<String, bool>,
    #[serde(deserialize_with = "lenient")]
    pub boilerplates: BTreeMap<String, String>,
    #[serde(deserialize_with = "lenient")]
    pub boilerplate_bank: String,
    /// Tauri 版で追加。Electron 版の Nani! の履歴を引き継ぎ済みか（migrate.rs）
    #[serde(deserialize_with = "lenient")]
    pub nani_migrated: bool,
    /// Tauri 版で追加。旧 Electron 版のアンインストールを尋ねたか（Windows のみ、migrate.rs）
    #[serde(deserialize_with = "lenient")]
    pub electron_uninstall_asked: bool,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            bounds: Bounds::default(),
            is_maximized: false,
            is_dark_mode: false,
            editor_mode: 0.0,
            browser_width: 550.0,
            browser_tab_index: 0.0,
            language: "plaintext".into(),
            font_size: 16.0,
            enabled_browsers: BTreeMap::new(),
            enabled_terminals: BTreeMap::new(),
            tab_orders: BTreeMap::new(),
            send_targets: BTreeMap::new(),
            boilerplates: BTreeMap::new(),
            boilerplate_bank: "A".into(),
            nani_migrated: false,
            electron_uninstall_asked: false,
        }
    }
}

/// レンダラーからの部分更新。指定されたフィールドだけ上書きする。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatePatch {
    pub is_dark_mode: Option<bool>,
    pub editor_mode: Option<f64>,
    pub language: Option<String>,
    pub font_size: Option<f64>,
    pub enabled_browsers: Option<BTreeMap<String, bool>>,
    pub enabled_terminals: Option<BTreeMap<String, bool>>,
    pub tab_orders: Option<BTreeMap<String, f64>>,
    pub send_targets: Option<BTreeMap<String, bool>>,
    pub boilerplates: Option<BTreeMap<String, String>>,
    pub boilerplate_bank: Option<String>,
}

impl AppState {
    pub fn apply(&mut self, patch: StatePatch) {
        if let Some(v) = patch.is_dark_mode {
            self.is_dark_mode = v;
        }
        if let Some(v) = patch.editor_mode {
            self.editor_mode = v;
        }
        if let Some(v) = patch.language {
            self.language = v;
        }
        if let Some(v) = patch.font_size {
            self.font_size = v;
        }
        if let Some(v) = patch.enabled_browsers {
            self.enabled_browsers = v;
        }
        if let Some(v) = patch.enabled_terminals {
            self.enabled_terminals = v;
        }
        if let Some(v) = patch.tab_orders {
            self.tab_orders = v;
        }
        if let Some(v) = patch.send_targets {
            self.send_targets = v;
        }
        if let Some(v) = patch.boilerplates {
            self.boilerplates = v;
        }
        if let Some(v) = patch.boilerplate_bank {
            if BOILERPLATE_BANKS.contains(&v.as_str()) {
                self.boilerplate_bank = v;
            }
        }
    }

    /// 現在のブラウザ・ターミナル構成に合わせて保存値を検証・移行する。
    /// Electron 版の createMainWindow() と同じ規則。
    pub fn normalize(&mut self, browser_ids: &[String], terminal_ids: &[String]) {
        // ブラウザ構成が変わっていたら有効状態とタブ順序をリセット
        if !same_keys(&self.enabled_browsers, browser_ids) {
            self.enabled_browsers = browser_ids.iter().map(|id| (id.clone(), true)).collect();
            self.tab_orders.clear();
        }

        // 送信対象の既定値（Nani! は除外）
        if self.send_targets.is_empty() {
            self.send_targets = browser_ids
                .iter()
                .map(|id| (id.clone(), id != "NANI"))
                .collect();
        }

        // 旧キー（"1"〜"0"）をバンク A（"A1"〜"A0"）へ移行
        for slot in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] {
            if let Some(text) = self.boilerplates.remove(slot) {
                let new_key = format!("A{slot}");
                let is_empty = self
                    .boilerplates
                    .get(&new_key)
                    .is_none_or(|existing| existing.is_empty());
                if is_empty {
                    self.boilerplates.insert(new_key, text);
                }
            }
        }

        if !BOILERPLATE_BANKS.contains(&self.boilerplate_bank.as_str()) {
            self.boilerplate_bank = "A".into();
        }

        // 旧既定値 'text' は Monaco の正規 ID では 'plaintext'
        if self.language.is_empty() || self.language == "text" {
            self.language = "plaintext".into();
        }

        if !same_keys(&self.enabled_terminals, terminal_ids) {
            self.enabled_terminals = terminal_ids.iter().map(|id| (id.clone(), true)).collect();
            self.tab_orders.clear();
        }

        // 型の不一致などで 0 になった数値を既定値に戻す
        if self.font_size <= 0.0 {
            self.font_size = 16.0;
        }
        if self.browser_width <= 0.0 {
            self.browser_width = 550.0;
        }
        if self.bounds.width <= 0.0 || self.bounds.height <= 0.0 {
            self.bounds = Bounds::default();
        }
    }
}

fn same_keys<V>(map: &BTreeMap<String, V>, ids: &[String]) -> bool {
    map.len() == ids.len() && ids.iter().all(|id| map.contains_key(id))
}

/// 読み込み結果。どこから読んだかはログ出力用。
pub struct Loaded {
    pub state: AppState,
    pub logs: Vec<Value>,
    pub state_source: Option<PathBuf>,
    pub logs_source: Option<PathBuf>,
}

/// data_dir にファイルがあればそれを、無ければ legacy_dirs（Electron 版の userData）から読む。
pub fn load(data_dir: &Path, legacy_dirs: &[PathBuf]) -> Loaded {
    let (state, state_source) =
        find_and_read::<AppState>(data_dir, legacy_dirs, STATE_FILE).unwrap_or_default();
    let (logs, logs_source) =
        find_and_read::<Vec<Value>>(data_dir, legacy_dirs, LOGS_FILE).unwrap_or_default();
    Loaded {
        state,
        logs,
        state_source,
        logs_source,
    }
}

fn find_and_read<T: DeserializeOwned>(
    data_dir: &Path,
    legacy_dirs: &[PathBuf],
    file_name: &str,
) -> Option<(T, Option<PathBuf>)> {
    std::iter::once(data_dir)
        .chain(legacy_dirs.iter().map(PathBuf::as_path))
        .map(|dir| dir.join(file_name))
        .find(|path| path.is_file())
        .and_then(|path| match read_json::<T>(&path) {
            Ok(value) => Some((value, Some(path))),
            Err(error) => {
                log::error!("{} の読み込みに失敗しました: {error}", path.display());
                None
            }
        })
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

pub fn save(data_dir: &Path, state: &AppState, logs: &[Value]) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    let state_json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    fs::write(data_dir.join(STATE_FILE), state_json).map_err(|e| e.to_string())?;
    // 人間が読みやすいようにログは整形して保存する
    let logs_json = serde_json::to_string_pretty(logs).map_err(|e| e.to_string())?;
    fs::write(data_dir.join(LOGS_FILE), logs_json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn lenient_keeps_other_fields_when_one_is_broken() {
        let json = r#"{"isDarkMode": true, "fontSize": "big", "language": "rust"}"#;
        let state: AppState = serde_json::from_str(json).unwrap();
        assert!(state.is_dark_mode);
        assert_eq!(state.language, "rust");
        assert_eq!(state.font_size, 0.0);
    }

    #[test]
    fn normalize_resets_when_browser_set_changes() {
        let mut state = AppState::default();
        state.enabled_browsers.insert("OLD".into(), false);
        state.tab_orders.insert("OLD".into(), 3.0);
        state.normalize(&ids(&["CHATGPT", "NANI"]), &ids(&["TERMINAL_1"]));
        assert_eq!(state.enabled_browsers.get("CHATGPT"), Some(&true));
        assert!(!state.enabled_browsers.contains_key("OLD"));
        assert!(state.tab_orders.is_empty());
        assert_eq!(state.send_targets.get("NANI"), Some(&false));
        assert_eq!(state.send_targets.get("CHATGPT"), Some(&true));
    }

    #[test]
    fn normalize_migrates_old_boilerplate_keys() {
        let mut state = AppState::default();
        state.boilerplates.insert("1".into(), "old".into());
        state.boilerplates.insert("2".into(), "old2".into());
        state.boilerplates.insert("A2".into(), "keep".into());
        state.language = "text".into();
        state.boilerplate_bank = "Z".into();
        state.normalize(&ids(&[]), &ids(&[]));
        assert_eq!(state.boilerplates.get("A1").map(String::as_str), Some("old"));
        assert_eq!(state.boilerplates.get("A2").map(String::as_str), Some("keep"));
        assert!(!state.boilerplates.contains_key("1"));
        assert_eq!(state.language, "plaintext");
        assert_eq!(state.boilerplate_bank, "A");
    }

    #[test]
    fn load_prefers_own_dir_and_falls_back_to_legacy() {
        let base = std::env::temp_dir().join(format!("aib-state-test-{}", std::process::id()));
        let own = base.join("own");
        let legacy = base.join("legacy");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join(STATE_FILE), r#"{"fontSize": 20}"#).unwrap();
        fs::write(legacy.join(LOGS_FILE), r#"[{"id": 1, "text": "hello"}]"#).unwrap();

        let loaded = load(&own, &[legacy.clone()]);
        assert_eq!(loaded.state.font_size, 20.0);
        assert_eq!(loaded.logs.len(), 1);
        assert_eq!(loaded.state_source, Some(legacy.join(STATE_FILE)));

        save(&own, &loaded.state, &loaded.logs).unwrap();
        fs::write(legacy.join(STATE_FILE), r#"{"fontSize": 30}"#).unwrap();
        let reloaded = load(&own, &[legacy]);
        assert_eq!(reloaded.state.font_size, 20.0);

        fs::remove_dir_all(&base).unwrap();
    }
}
