import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { ConsoleCommentPage } from './console-comments.service.js';
import { CommentRecord } from './comments.service.js';
import { AuditLogsService } from './audit-logs.service.js';

export const rejectionCodes = ['violates_guidelines', 'spam', 'harassment', 'hate', 'sexual_content', 'misinformation'] as const;
export type RejectionCode = typeof rejectionCodes[number];

@Injectable()
export class ModerationService {
  constructor(private readonly database: DatabaseService, private readonly auditLogs: AuditLogsService) {}

  async pending(applicationKey: string, page: number, pageSize: number): Promise<ConsoleCommentPage> {
    const result = await this.database.query<CommentRecord & { total: string }>(
      `SELECT comment.id, comment.article_key AS "articleKey", comment.root_comment_id AS "rootCommentId", comment.author_id AS "authorId", comment.author_name AS "authorName", comment.author_avatar_url AS "authorAvatarUrl", comment.body, comment.status, comment.created_at AS "createdAt", 0::integer AS "replyCount", 0::integer AS heat, count(*) OVER()::text AS total FROM comments comment JOIN applications application ON application.id = comment.application_id WHERE application.key = $1 AND comment.status = 'pending' ORDER BY comment.created_at ASC, comment.id ASC LIMIT $2 OFFSET $3`,
      [applicationKey, pageSize, (page - 1) * pageSize]
    );
    const total = Number(result.rows[0]?.total ?? 0);
    return { items: result.rows.map(({ total: _total, ...comment }) => comment), page, pageSize, total };
  }

  async approve(applicationKey: string, commentId: string, operatorId: string): Promise<void> {
    await this.transition(applicationKey, commentId, 'published', null, operatorId);
  }

  async reject(applicationKey: string, commentId: string, rejectionCode: RejectionCode, operatorId: string): Promise<void> {
    await this.transition(applicationKey, commentId, 'rejected', rejectionCode, operatorId);
  }

  private async transition(applicationKey: string, commentId: string, status: 'published' | 'rejected', rejectionCode: RejectionCode | null, operatorId: string): Promise<void> {
    await this.database.transaction(async (database) => {
      const result = await database.query(
        `UPDATE comments comment SET status = $3, rejection_code = $4 FROM applications application WHERE application.id = comment.application_id AND application.key = $1 AND comment.id = $2 AND comment.status = 'pending'`,
        [applicationKey, commentId, status, rejectionCode]
      );
      if (result.rowCount !== 1) throw new NotFoundException();
      await this.auditLogs.record(database, applicationKey, `comment.${status === 'published' ? 'approved' : 'rejected'}`, 'comment', commentId, rejectionCode ? { rejectionCode } : {}, operatorId);
    });
  }
}