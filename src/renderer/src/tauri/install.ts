// Tauri で動いているときだけ、window.electron / window.api を互換レイヤーで用意する。
// main.tsx の先頭で読み込み、App のモジュールより先に評価させる。
import { installTauriCompat, isTauri } from './electronCompat';

if (isTauri()) {
  installTauriCompat();
}
