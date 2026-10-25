import babelPlugin from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

import { resolve } from 'node:path';

const reactDevtoolsUrl = 'http://localhost:8097';

function reactDevtoolsHtmlPlugin(isDevServer: boolean): Plugin {
  return {
    name: 'react-devtools-html',
    transformIndexHtml(html) {
      const transformedHtml = html
        .replace(
          '__REACT_DEVTOOLS_CONNECT_SRC__',
          isDevServer ? ` ws://localhost:8097 ${reactDevtoolsUrl}` : '',
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
            attrs: {
              src: reactDevtoolsUrl,
            },
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
    main: {
      // 依存の外部化は electron-vite 6 の build.externalizeDeps（既定で有効）に任せる
      build: {
        rolldownOptions: {
          external: ['node-pty'],
        },
      },
    },
    preload: {
      // sandbox: true で動かすため、preload は ESM ではなく CJS にし、
      // 依存（@electron-toolkit/preload 等）はバンドルする。
      // サンドボックス化された preload は ESM import / 任意モジュールの
      // require ができないため、'electron' のみ external（実行時提供）とする。
      // electron-vite 6 は既定で依存を外部化するので externalizeDeps を無効にする。
      build: {
        externalizeDeps: false,
        rolldownOptions: {
          external: ['electron'],
          output: {
            format: 'cjs',
            entryFileNames: 'index.cjs',
          },
        },
      },
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src'),
          '@': resolve('src/renderer/src'),
        },
      },
      // 開発サーバーでは monaco-editor が事前バンドルされるため、そちらにも適用する
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
        reactDevtoolsHtmlPlugin(isDevServer),
      ],
    },
  };
});
