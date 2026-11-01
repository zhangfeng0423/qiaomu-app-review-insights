'use client';

import { useState, type ReactNode } from 'react';
import { Lightbulb, TrendingUp, MessageSquareQuote } from 'lucide-react';

interface DetailClientProps {
  insightsCount: number;
  reviewsCount: number;
  insightsTabContent: ReactNode;
  trendsTabContent: ReactNode;
  evidenceTabContent: ReactNode;
}

export function DetailClient({
  insightsCount,
  reviewsCount,
  insightsTabContent,
  trendsTabContent,
  evidenceTabContent,
}: DetailClientProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'trends' | 'evidence'>('insights');

  const tabs = [
    {
      id: 'insights' as const,
      label: '核心洞察',
      icon: Lightbulb,
      count: insightsCount ? `${insightsCount} 个点` : undefined,
    },
    {
      id: 'trends' as const,
      label: '趋势与分布',
      icon: TrendingUp,
    },
    {
      id: 'evidence' as const,
      label: '用户原声证据',
      icon: MessageSquareQuote,
      count: `${reviewsCount} 条`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 现代渐进式 Tab 导航栏 */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-zinc-200/80 bg-white/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-2 py-2.5">
          <nav className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none" aria-label="洞察报告导航" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(event) => {
                    const current = tabs.findIndex(item => item.id === activeTab);
                    const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length
                      : event.key === 'ArrowLeft' ? (current + tabs.length - 1) % tabs.length
                      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    setActiveTab(tabs[next].id);
                    document.getElementById(`tab-${tabs[next].id}`)?.focus();
                  }}
                  className={`group inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-zinc-950 text-white shadow-sm'
                      : 'bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  <Icon className={`h-4 w-4 transition ${isActive ? 'text-teal-400' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                  <span>{tab.label}</span>
                  {tab.count ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-normal ${
                        isActive ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Panels: 所有内容全部真实存在于 DOM 中以保证 SEO 爬虫完整索引 */}
      <div className="space-y-6">
        <div
          role="tabpanel"
          id="panel-insights"
          aria-labelledby="tab-insights"
          tabIndex={0}
          className={activeTab === 'insights' ? 'block animate-fadeIn' : 'hidden'}
        >
          {insightsTabContent}
        </div>

        <div
          role="tabpanel"
          id="panel-trends"
          aria-labelledby="tab-trends"
          tabIndex={0}
          className={activeTab === 'trends' ? 'block animate-fadeIn' : 'hidden'}
        >
          {trendsTabContent}
        </div>

        <div
          role="tabpanel"
          id="panel-evidence"
          aria-labelledby="tab-evidence"
          tabIndex={0}
          className={activeTab === 'evidence' ? 'block animate-fadeIn' : 'hidden'}
        >
          {evidenceTabContent}
        </div>
      </div>
    </div>
  );
}
