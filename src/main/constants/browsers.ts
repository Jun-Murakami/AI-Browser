import { BROWSER_DEFINITIONS } from '../../shared/constants/browsers';
import { BROWSER_SCRIPTS } from '../scripts/browserScripts';

import type { Browser } from '../types/interfaces';

// 共通定義にスクリプトを追加してBrowser型に変換
export const BROWSERS: Browser[] = BROWSER_DEFINITIONS.map(
  (def): Browser => ({
    ...def,
    // urlPattern がオプショナルのため、未定義の場合は url を用いて補完する
    urlPattern: def.urlPattern ?? def.url,
    script: BROWSER_SCRIPTS[def.id],
  }),
);

export const EXPECTED_BROWSER_COUNT = BROWSERS.length;

export const BROWSER_URLS = Object.fromEntries(
  BROWSERS.map((browser) => [browser.id, browser.url]),
) as Record<string, string>;

export const URL_PATTERNS = BROWSERS.map((browser) => ({
  index: browser.index,
  pattern: browser.urlPattern,
  url: browser.url,
}));
