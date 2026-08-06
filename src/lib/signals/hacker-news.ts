import { ProductSignal, HackerNewsSignalKind } from '@/lib/signals/types';

const HACKER_NEWS_BASE = 'https://hacker-news.firebaseio.com/v0';

interface HackerNewsItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  descendants?: number;
}

function stripHtml(value?: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${HACKER_NEWS_BASE}/${path}.json`, {
    next: { revalidate: 900 },
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`Hacker News API returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchStoryIds(kind: HackerNewsSignalKind) {
  const endpoint = kind === 'show' ? 'showstories' : kind === 'ask' ? 'askstories' : 'topstories';
  return fetchJson<number[]>(endpoint);
}

async function fetchStory(id: number) {
  return fetchJson<HackerNewsItem>(`item/${id}`);
}

async function fetchKind(kind: HackerNewsSignalKind, limit: number) {
  const ids = await fetchStoryIds(kind);
  const stories = await Promise.all(ids.slice(0, limit).map(fetchStory));

  return stories
    .filter((story) => story && story.title && story.type === 'story')
    .map((story): ProductSignal => ({
      id: `hn_${story.id}`,
      source: 'hackernews',
      kind,
      title: stripHtml(story.title),
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      sourceUrl: `https://news.ycombinator.com/item?id=${story.id}`,
      author: story.by,
      score: story.score,
      comments: story.descendants,
      publishedAt: story.time ? new Date(story.time * 1000).toISOString() : undefined,
      excerpt: stripHtml(story.text),
    }));
}

export async function fetchHackerNewsSignals(): Promise<ProductSignal[]> {
  const [top, show, ask] = await Promise.all([
    fetchKind('top', 8),
    fetchKind('show', 6),
    fetchKind('ask', 6),
  ]);

  return [...show, ...ask, ...top].slice(0, 20);
}

