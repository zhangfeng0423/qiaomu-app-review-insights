export type HackerNewsSignalKind = 'top' | 'show' | 'ask';

export interface ProductSignal {
  id: string;
  source: 'hackernews';
  kind: HackerNewsSignalKind;
  title: string;
  url: string;
  sourceUrl: string;
  author?: string;
  score?: number;
  comments?: number;
  publishedAt?: string;
  excerpt?: string;
}

