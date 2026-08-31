import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

export interface ReportRecord { id: string; reporterId: string; commentId: string; reportedAuthorId: string; reasonCategory: string; createdAt: string; }
export interface AutoBanRecord { memberId: string; mode: 'normal' | 'full'; expiresAt: string | null; triggerCount: number; }
export interface ConsolePage<T> { items: T[]; page: number; pageSize: number; total: number; }

@Injectable()
export class ConsoleReportsService {
  constructor(private readonly database: DatabaseService) {}

  async reports(applicationKey: string, page: number, pageSize: number): Promise<ConsolePage<ReportRecord>> {
    return this.page<ReportRecord>(`SELECT report.id, report.reporter_id AS "reporterId", report.comment_id AS "commentId", report.reported_author_id AS "reportedAuthorId", report.reason_category AS "reasonCategory", report.created_at AS "createdAt", count(*) OVER()::text AS total FROM reports report JOIN applications application ON application.id = report.application_id WHERE application.key = $1 ORDER BY report.created_at DESC, report.id DESC LIMIT $2 OFFSET $3`, applicationKey, page, pageSize);
  }

  async autoBans(applicationKey: string, page: number, pageSize: number): Promise<ConsolePage<AutoBanRecord>> {
    return this.page<AutoBanRecord>(`SELECT block.member_id AS "memberId", block.mode, block.expires_at AS "expiresAt", offense.trigger_count AS "triggerCount", count(*) OVER()::text AS total FROM user_blocks block JOIN applications application ON application.id = block.application_id JOIN user_offenses offense ON offense.application_id = block.application_id AND offense.member_id = block.member_id WHERE application.key = $1 AND block.source = 'auto' ORDER BY block.expires_at NULLS LAST, block.member_id ASC LIMIT $2 OFFSET $3`, applicationKey, page, pageSize);
  }

  private async page<T>(sql: string, applicationKey: string, page: number, pageSize: number): Promise<ConsolePage<T>> {
    const result = await this.database.query<T & { total: string }>(sql, [applicationKey, pageSize, (page - 1) * pageSize]);
    const total = Number(result.rows[0]?.total ?? 0);
    return { items: result.rows.map(({ total: _total, ...item }) => item as T), page, pageSize, total };
  }
}