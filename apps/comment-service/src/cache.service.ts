import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { HotArticle } from './comments.service.js';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });

  async getHotArticles(applicationKey: string, limit: number): Promise<HotArticle[] | undefined> {
    try {
      const value = await this.redis.get(this.hotKey(applicationKey, limit));
      return value ? JSON.parse(value) as HotArticle[] : undefined;
    } catch { return undefined; }
  }

  async setHotArticles(applicationKey: string, limit: number, articles: HotArticle[]): Promise<void> {
    try { await this.redis.set(this.hotKey(applicationKey, limit), JSON.stringify(articles), 'EX', 30); } catch { /* Cache availability must not affect API correctness. */ }
  }

  async invalidateHotArticles(applicationKey: string): Promise<void> {
    try { await this.redis.del(Array.from({ length: 50 }, (_, index) => this.hotKey(applicationKey, index + 1))); } catch { /* Cache availability must not affect writes. */ }
  }

  async flushAll(): Promise<void> {
    try { await this.redis.flushdb(); } catch { /* Cache availability must not affect the reset. */ }
  }

  async onModuleDestroy(): Promise<void> { this.redis.disconnect(); }

  private hotKey(applicationKey: string, limit: number): string { return `comment:${applicationKey}:hot:${limit}`; }
}