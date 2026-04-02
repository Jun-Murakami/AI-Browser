// 共通のブラウザ定義
export interface BrowserDefinition {
  id: string;
  label: string;
  index: number;
  url: string;
  urlPattern?: string | string[];
  group: 'primary' | 'secondary'; // primary: ターミナルタブの前, secondary: ターミナルタブの後
}

export const BROWSER_DEFINITIONS: BrowserDefinition[] = [
  {
    id: 'CHATGPT',
    label: 'ChatGPT',
    index: 0,
    url: 'https://chatgpt.com/',
    urlPattern: 'chatgpt.com',
    group: 'primary',
  },
  {
    id: 'GEMINI',
    label: 'Gemini',
    index: 1,
    url: 'https://gemini.google.com/',
    urlPattern: 'gemini.google.com',
    group: 'primary',
  },
  {
    id: 'CLAUDE',
    label: 'Claude',
    index: 2,
    url: 'https://claude.ai/',
    urlPattern: 'claude.ai',
    group: 'primary',
  },
  {
    id: 'GROK',
    label: 'Grok',
    index: 3,
    url: 'https://grok.com/',
    urlPattern: ['x.com', 'grok'],
    group: 'primary',
  },
  {
    id: 'KIMI',
    label: 'Kimi',
    index: 4,
    url: 'https://kimi.com/',
    urlPattern: 'kimi.com',
    group: 'primary',
  },
  {
    id: 'DEEPSEEK',
    label: 'DeepSeek',
    index: 5,
    url: 'https://chat.deepseek.com/',
    urlPattern: 'deepseek.com',
    group: 'primary',
  },
  {
    id: 'SAKANA',
    label: 'Sakana',
    index: 6,
    url: 'https://chat.sakana.ai/',
    urlPattern: 'sakana.ai',
    group: 'primary',
  },
  {
    id: 'NANI',
    label: 'Nani !?',
    index: 7,
    url: 'https://nani.now/',
    urlPattern: 'nani.now',
    group: 'primary',
  },
  {
    id: 'PERPLEXITY',
    label: 'Perplexity',
    index: 8,
    url: 'https://www.perplexity.ai/',
    urlPattern: 'perplexity.ai',
    group: 'primary',
  },
  {
    id: 'GENSPARK',
    label: 'Genspark',
    index: 9,
    url: 'https://www.genspark.ai/',
    urlPattern: 'genspark.ai',
    group: 'primary',
  },
];
