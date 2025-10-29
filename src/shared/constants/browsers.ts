// 共通のブラウザ定義
export interface BrowserDefinition {
  id: string;
  label: string;
  index: number;
  url: string;
  urlPattern?: string | string[];
}

export const BROWSER_DEFINITIONS: BrowserDefinition[] = [
  {
    id: 'CHATGPT',
    label: 'ChatGPT',
    index: 0,
    url: 'https://chatgpt.com/',
    urlPattern: 'chatgpt.com',
  },
  {
    id: 'GEMINI',
    label: 'Gemini',
    index: 1,
    url: 'https://gemini.google.com/',
    urlPattern: 'gemini.google.com',
  },
  {
    id: 'AISTUDIO',
    label: 'AIStudio',
    index: 2,
    url: 'https://aistudio.google.com/',
    urlPattern: ['aistudio.google.com', 'ai.google.dev'],
  },
  {
    id: 'CLAUDE',
    label: 'Claude',
    index: 3,
    url: 'https://claude.ai/',
    urlPattern: 'claude.ai',
  },
  {
    id: 'DEEPSEEK',
    label: 'DeepSeek',
    index: 4,
    url: 'https://chat.deepseek.com/',
    urlPattern: 'deepseek.com',
  },
  {
    id: 'GROK',
    label: 'Grok',
    index: 5,
    url: 'https://grok.com/',
    urlPattern: ['x.com', 'grok'],
  },
  {
    id: 'PHIND',
    label: 'Phind',
    index: 6,
    url: 'https://www.phind.com/',
    urlPattern: 'phind.com',
  },
  {
    id: 'PERPLEXITY',
    label: 'Perplexity',
    index: 7,
    url: 'https://www.perplexity.ai/',
    urlPattern: 'perplexity.ai',
  },
  {
    id: 'GENSPARK',
    label: 'Genspark',
    index: 8,
    url: 'https://www.genspark.ai/',
    urlPattern: 'genspark.ai',
  },
  {
    id: 'FELO',
    label: 'Felo',
    index: 9,
    url: 'https://felo.ai/',
    urlPattern: 'felo.ai',
  },
  {
    id: 'JENOVA',
    label: 'JENOVA',
    index: 10,
    url: 'https://app.jenova.ai/',
    urlPattern: 'jenova.ai',
  },
  {
    id: 'CODY',
    label: 'Cody',
    index: 11,
    url: 'https://sourcegraph.com/cody/chat',
    urlPattern: 'sourcegraph.com',
  },
  {
    id: 'NANI',
    label: 'Nani !?',
    index: 15,
    url: 'https://nani.now/',
    urlPattern: 'nani.now',
  },
];
