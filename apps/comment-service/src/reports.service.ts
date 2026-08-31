import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ulid } from 'ulid';
import { DatabaseService } from './database.service.js';
import { AutoBanService } from './auto-ban.service.js';

export type ReportReason = 'spam' | 'harassment' | 'hate' | 'misinformation' | 'sexual_content' | 'violence';

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService, private readonly autoBan: AutoBanService) {}

  async create(applicationKey: string, reporterId: string, commentId: string, reason: ReportReason): Promise<void> {
    return this.database.transaction(async (database) => {
    const comment = await database.query<{ application_id: string; author_id: string; status: string }>(
      `SELECT comment.application_id, comment.author_id, comment.status FROM comments comment JOIN applications application ON application.id = comment.application_id WHERE application.key = $1 AND application.status = 'active' AND comment.id = $2`,
      [applicationKey, commentId]
    );
    if (comment.rowCount !== 1) throw new NotFoundException();
    const target = comment.rows[0];
    if (target.status === 'deleted') throw new ConflictException({ code: 'cannot_report_deleted_comment', message: 'Deleted comments cannot be reported' });
    if (target.author_id === reporterId) throw new UnprocessableEntityException({ code: 'cannot_report_own_comment', message: 'A member cannot report their own comment' });
    try {
      await database.query(
        `INSERT INTO reports (id, application_id, reporter_id, comment_id, reported_author_id, reason_category) VALUES ($1, $2, $3, $4, $5, $6)`,
        [ulid(), target.application_id, reporterId, commentId, target.author_id, reason]
      );
      await this.autoBan.evaluate(database, target.application_id, target.author_id);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new ConflictException({ code: 'comment_already_reported', message: 'Comment was already reported' });
      throw error;
    }
    });
  }
}