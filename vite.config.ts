// レンダラー（src/renderer）のビルド設定。tauri dev / tauri build から呼ばれる（src-tauri/tauri.conf.json の build）。
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

// monaco-editor は DOMPurify を npm 依存ではなく自前のコピー
// （esm/vs/base/browser/dompurify/dompurify.js）として同梱しており、
// package.json の overrides だけでは実際にバンドルされるコードが更新されない。
// そこで同梱コピーの中身を npm の dompurify（overrides で修正版に固定）の
// 再エクスポートに置き換える。相対 import は resolveId を経由しないため load で差し替える。
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
      // tauri.conf.json の build.devUrl と合わせる
      port: 1420,
      strictPort: true,
    },
    build: {
      // dist/ は Electron 版のビルド成果物が残っていることがあるので使わない
      outDir: resolve('out/renderer'),
      emptyOutDir: true,
      // WebView2 / WKWebView / WebKitGTK の対応範囲
      target: ['es2022', 'chrome120', 'safari16'],
    },
  };
});
