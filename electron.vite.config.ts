import babelPlugin from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
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

export default defineConfig(({ command }) => {
  const isDevServer = command === 'serve';

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          external: ['node-pty'],
        },
      },
    },
    preload: {
      // sandbox: true で動かすため、preload は ESM ではなく CJS にし、
      // 依存（@electron-toolkit/preload 等）はバンドルする。
      // サンドボックス化された preload は ESM import / 任意モジュールの
      // require ができないため、'electron' のみ external（実行時提供）とする。
      build: {
        rollupOptions: {
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
      plugins: [
        react(),
        babelPlugin({
          presets: [reactCompilerPreset()],
        }),
        reactDevtoolsHtmlPlugin(isDevServer),
      ],
    },
  };
});
