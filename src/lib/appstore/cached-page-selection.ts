import { normalizeCountry } from '@/lib/appstore/discovery';

export type CachedPageSelectionOperation = 'read' | 'write';

export interface CachedPageSelectionPage {
  app: {
    id: string;
    country: string;
  };
  updatedAt: string;
}

export interface CachedPageSelectionResult<T extends CachedPageSelectionPage> {
  status: 'resolved' | 'not-found' | 'ambiguous';
  page: T | null;
  availableCountries: string[];
}

export function selectCachedPage<T extends CachedPageSelectionPage>(
  pages: T[],
  options: { country?: string; operation?: CachedPageSelectionOperation } = {}
): CachedPageSelectionResult<T> {
  const availableCountries = Array.from(new Set(pages.map((page) => normalizeCountry(page.app.country)))).sort();
  const country = options.country ? normalizeCountry(options.country) : undefined;

  if (country) {
    return {
      status: pages.some((page) => normalizeCountry(page.app.country) === country) ? 'resolved' : 'not-found',
      page: pages.find((item) => normalizeCountry(item.app.country) === country) || null,
      availableCountries,
    };
  }

  if (pages.length === 0) {
    return { status: 'not-found', page: null, availableCountries };
  }

  if (pages.length > 1 && options.operation === 'write') {
    return { status: 'ambiguous', page: null, availableCountries };
  }

  const page = [...pages].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  })[0];

  return { status: 'resolved', page, availableCountries };
}
