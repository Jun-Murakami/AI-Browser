import { UrlPattern } from '../types/interfaces';

export const EXPECTED_BROWSER_COUNT = 10;

export const BROWSER_URLS = {
  CHATGPT: 'https://chatgpt.com/',
  GEMINI: 'https://gemini.google.com/',
  CLAUDE: 'https://claude.ai/',
  DEEPSEEK: 'https://chat.deepseek.com/',
  PHIND: 'https://www.phind.com/',
  PERPLEXITY: 'https://www.perplexity.ai/',
  GENSPARK: 'https://www.genspark.ai/',
  AISTUDIO: 'https://aistudio.google.com/',
  FELO: 'https://felo.ai/',
  JENOVA: 'https://app.jenova.ai/',
  CODY: 'https://sourcegraph.com/cody/chat',
} as const;

export const URL_PATTERNS: UrlPattern[] = [
  { index: 0, pattern: 'chatgpt.com', url: BROWSER_URLS.CHATGPT },
  { index: 1, pattern: 'gemini.google.com', url: BROWSER_URLS.GEMINI },
  { index: 2, pattern: 'claude.ai', url: BROWSER_URLS.CLAUDE },
  { index: 3, pattern: 'deepseek.com', url: BROWSER_URLS.DEEPSEEK },
  { index: 4, pattern: 'phind.com', url: BROWSER_URLS.PHIND },
  { index: 5, pattern: 'perplexity.ai', url: BROWSER_URLS.PERPLEXITY },
  { index: 6, pattern: 'genspark.ai', url: BROWSER_URLS.GENSPARK },
  //{ index: 6, pattern: ['aistudio.google.com', 'ai.google.dev'], url: BROWSER_URLS.AISTUDIO },
  { index: 7, pattern: 'felo.ai', url: BROWSER_URLS.FELO },
  { index: 8, pattern: 'jenova.ai', url: BROWSER_URLS.JENOVA },
  { index: 9, pattern: 'sourcegraph.com', url: BROWSER_URLS.CODY },
];
