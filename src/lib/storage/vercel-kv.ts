import { BaseStorage } from './base';
import { App, AppStoreReview, AnalysisResult, PromptTemplate } from '@/types';

interface KVClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
}

// Vercel KV 存储实现
export class VercelKVStorage extends BaseStorage {
  private kv: KVClient | null = null;

  constructor() {
    super();
    // 动态导入 Vercel KV，避免在本地开发时出错
    this.initKV();
  }

  private async initKV() {
    try {
      const { kv } = await import('@vercel/kv');
      this.kv = kv;
    } catch {
      console.warn('Vercel KV not available, falling back to local storage');
      throw new Error('Vercel KV not available');
    }
  }

  private async ensureKV() {
    if (!this.kv) {
      await this.initKV();
    }
  }

  private getKV(): KVClient {
    if (!this.kv) throw new Error('Vercel KV not available');
    return this.kv;
  }

  async getApps(): Promise<App[]> {
    await this.ensureKV();
    const apps = await this.getKV().get<App[]>('apps');
    return apps || [];
  }

  async saveApps(apps: App[]): Promise<void> {
    await this.ensureKV();
    await this.getKV().set('apps', apps);
  }

  async getReviews(appId?: string): Promise<AppStoreReview[]> {
    await this.ensureKV();
    const allReviews = await this.getKV().get<AppStoreReview[]>('reviews') || [];
    return this.filterByAppId(allReviews, appId);
  }

  async getReviewsPage(appId: string, offset: number, limit: number): Promise<AppStoreReview[]> {
    const reviews = await this.getReviews(appId);
    return reviews.slice(offset, offset + limit);
  }

  async saveReviews(reviews: AppStoreReview[]): Promise<void> {
    await this.ensureKV();
    const existingReviews = await this.getKV().get<AppStoreReview[]>('reviews') || [];
    const mergedReviews = this.mergeArrays(existingReviews, reviews);
    const sortedReviews = this.sortByDate(mergedReviews, 'updated');
    await this.getKV().set('reviews', sortedReviews);
  }

  async getAnalysisResults(appId?: string): Promise<AnalysisResult[]> {
    await this.ensureKV();
    const allResults = await this.getKV().get<AnalysisResult[]>('analysis') || [];
    return this.filterByAppId(allResults, appId);
  }

  async saveAnalysisResults(results: AnalysisResult[]): Promise<void> {
    await this.ensureKV();
    const existingResults = await this.getKV().get<AnalysisResult[]>('analysis') || [];
    const mergedResults = this.mergeArrays(existingResults, results);
    const sortedResults = this.sortByDate(mergedResults, 'analyzedAt');
    await this.getKV().set('analysis', sortedResults);
  }

  async getPromptTemplates(): Promise<PromptTemplate[]> {
    await this.ensureKV();
    const templates = await this.getKV().get<PromptTemplate[]>('prompts');
    
    if (!templates || templates.length === 0) {
      const defaultTemplate: PromptTemplate = {
        id: 'default',
        name: '默认分析模板',
        description: '通用的应用评论分析模板',
        content: `请分析以下应用评论：

标题：{title}
内容：{content}
评分：{rating}星
版本：{version}

请按照系统提示的格式返回分析结果。`,
        systemPrompt: `你是一个专业的应用评论分析师。请分析用户评论，提取关键信息。

分析要求：
1. 判断情感倾向：positive（正面）、negative（负面）、neutral（中性）
2. 识别主要问题：提取用户反馈的具体问题和 bug
3. 提取改进建议：用户提出的功能建议和改进意见
4. 版本相关信息：如果评论提到特定版本的问题

请以 JSON 格式返回结果：
{
  "sentiment": "positive|negative|neutral",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "versionRefs": ["版本相关信息"]
}`,
        userPromptTemplate: `请分析以下应用评论：

标题：{title}
内容：{content}
评分：{rating}星
版本：{version}

请按照系统提示的格式返回分析结果。`,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };
      
      await this.getKV().set('prompts', [defaultTemplate]);
      return [defaultTemplate];
    }
    
    return templates;
  }

  async savePromptTemplates(templates: PromptTemplate[]): Promise<void> {
    await this.ensureKV();
    await this.getKV().set('prompts', templates);
  }
}
