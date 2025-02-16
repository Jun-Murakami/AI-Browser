import type { Browser } from '../types/interfaces';
import { BROWSER_SCRIPTS } from '../scripts/browserScripts';

export const BROWSERS: Browser[] = [
  {
    id: 'CHATGPT',
    label: 'ChatGPT',
    index: 0,
    url: 'https://chatgpt.com/',
    urlPattern: 'chatgpt.com',
    script: BROWSER_SCRIPTS.CHATGPT
  },
  {
    id: 'GEMINI',
    label: 'Gemini',
    index: 1,
    url: 'https://gemini.google.com/',
    urlPattern: 'gemini.google.com',
    script: BROWSER_SCRIPTS.GEMINI
  },
  {
    id: 'AISTUDIO',
    label: 'AIStudio',
    index: 2,
    url: 'https://aistudio.google.com/',
    urlPattern: ['aistudio.google.com', 'ai.google.dev'],
    script: BROWSER_SCRIPTS.AISTUDIO
  },
  {
    id: 'CLAUDE',
    label: 'Claude',
    index: 3,
    url: 'https://claude.ai/',
    urlPattern: 'claude.ai',
    script: BROWSER_SCRIPTS.CLAUDE
  },
  {
    id: 'DEEPSEEK',
    label: 'DeepSeek',
    index: 4,
    url: 'https://chat.deepseek.com/',
    urlPattern: 'deepseek.com',
    script: BROWSER_SCRIPTS.DEEPSEEK
  },
  {
    id: 'GROK',
    label: 'Grok',
    index: 5,
    url: 'https://grok.x.com/',
    urlPattern: ['x.com', 'grok'],
    script: BROWSER_SCRIPTS.GROK
  },
  {
    id: 'PHIND',
    label: 'Phind',
    index: 6,
    url: 'https://www.phind.com/',
    urlPattern: 'phind.com',
    script: BROWSER_SCRIPTS.PHIND
  },
  {
    id: 'PERPLEXITY',
    label: 'Perplexity',
    index: 7,
    url: 'https://www.perplexity.ai/',
    urlPattern: 'perplexity.ai',
    script: BROWSER_SCRIPTS.PERPLEXITY
  },
  {
    id: 'GENSPARK',
    label: 'Genspark',
    index: 8,
    url: 'https://www.genspark.ai/',
    urlPattern: 'genspark.ai',
    script: BROWSER_SCRIPTS.GENSPARK
  },
  {
    id: 'FELO',
    label: 'Felo',
    index: 9,
    url: 'https://felo.ai/',
    urlPattern: 'felo.ai',
    script: BROWSER_SCRIPTS.FELO
  },
  {
    id: 'JENOVA',
    label: 'JENOVA',
    index: 10,
    url: 'https://app.jenova.ai/',
    urlPattern: 'jenova.ai',
    script: BROWSER_SCRIPTS.JENOVA
  },
  {
    id: 'CODY',
    label: 'Cody',
    index: 11,
    url: 'https://sourcegraph.com/cody/chat',
    urlPattern: 'sourcegraph.com',
    script: BROWSER_SCRIPTS.CODY
  }
];

export const EXPECTED_BROWSER_COUNT = BROWSERS.length;

export const BROWSER_URLS = Object.fromEntries(
  BROWSERS.map(browser => [browser.id, browser.url])
) as Record<string, string>;

export const URL_PATTERNS = BROWSERS.map(browser => ({
  index: browser.index,
  pattern: browser.urlPattern,
  url: browser.url
}));
