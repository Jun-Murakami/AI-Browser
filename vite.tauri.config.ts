// Tauri 版のレンダラービルド設定。
// electron.vite.config.ts の renderer 設定と同じプラグイン構成にしている。
// 移行期間中は main ブランチからのマージで衝突しないよう、あちらは変更せず別ファイルにする。
import babelPlugin from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

import { resolve } from 'node:path';

const reactDevtoolsUrl = 'http://localhost:8097';

// Tauri の IPC は Windows では http://ipc.localhost、macOS/Linux では ipc: スキームを使う
const TAURI_IPC_CONNECT_SRC = ' ipc: http://ipc.localhost';

/**
 * index.html の CSP プレースホルダを置き換える。
 * Tauri の IPC 用の接続先は常に追加し、開発サーバーでは React DevTools も許可する。
 */
function cspHtmlPlugin(isDevServer: boolean): Plugin {
  return {
    name: 'tauri-csp-html',
    transformIndexHtml(html) {
      const transformedHtml = html
        .replace(
          '__REACT_DEVTOOLS_CONNECT_SRC__',
          `${TAURI_IPC_CONNECT_SRC}${
            isDevServer ? ` ws://localhost:8097 ${reactDevtoolsUrl}` : ''
          }`,
        )
        .replace(
          '__REACT_DEVTOOLS_SCRIPT_SRC__',
          isDevServer ? ` ${reactDevtoolsUrl}` : '',
        );

      if (!isDevServer) {
        return transformedHtml;
      }

      return {
        html: transformedHtml,
        tags: [
          {
            tag: 'script',
            attrs: { src: reactDevtoolsUrl },
            injectTo: 'body-prepend',
          },
        ],
      };
    },
  };
}

// monaco-editor が同梱している DOMPurify のコピーを npm の dompurify に差し替える
// （理由は electron.vite.config.ts の同名プラグインを参照）
const MONACO_VENDORED_DOMPURIFY =
  /monaco-editor[\\/]esm[\\/]vs[\\/]base[\\/]browser[\\/]dompurify[\\/]dompurify\.js$/;

function monacoDompurifyPlugin(): Plugin {
  return {
    name: 'monaco-dompurify',
    load(id) {
      if (MONACO_VENDORED_DOMPURIFY.test(id)) {
        return "export { default } from 'dompurify';";
      }
      return null;
    },
  };
}

export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';

  return {
    root: resolve('src/renderer'),
    // Tauri の CLI 出力を Vite が消さないようにする
    clearScreen: false,
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
      },
    },
    optimizeDeps: {
      rolldownOptions: {
        plugins: [monacoDompurifyPlugin()],
      },
    },
    plugins: [
      monacoDompurifyPlugin(),
      react(),
      babelPlugin({
        presets: [reactCompilerPreset()],
      }),
      cspHtmlPlugin(isDevServer),
    ],
    server: {
      // electron-vite の開発サーバー（5173）と同時に起動できるよう別ポートにする
      port: 5174,
      strictPort: true,
    },
    build: {
      outDir: resolve('out/tauri-renderer'),
      emptyOutDir: true,
      // WebView2 / WKWebView / WebKitGTK の対応範囲
      target: ['es2022', 'chrome120', 'safari16'],
    },
  };
});
