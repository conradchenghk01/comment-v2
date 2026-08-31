import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { CommentRecord } from './comments.service.js';
import { AuditLogsService } from './audit-logs.service.js';

export interface ConsoleCommentPage { items: CommentRecord[]; page: number; pageSize: number; total: number; }
export interface ConsoleCommentFilters { keyword?: string; articleKey?: string; status?: 'pending' | 'published' | 'rejected' | 'deleted'; from?: string; to?: string; page: number; pageSize: number; }

@Injectable()
export class ConsoleCommentsService {
  constructor(private readonly database: DatabaseService, private readonly auditLogs: AuditLogsService) {}

  async list(applicationKey: string, filters: ConsoleCommentFilters): Promise<ConsoleCommentPage> {
    const values: unknown[] = [applicationKey];
    const where = ['application.key = $1'];
    if (filters.keyword) { values.push(`%${filters.keyword}%`); where.push(`comment.body ILIKE $${values.length}`); }
    if (filters.articleKey) { values.push(filters.articleKey); where.push(`comment.article_key = $${values.length}`); }
    if (filters.status) { values.push(filters.status); where.push(`comment.status = $${values.length}`); }
    if (filters.from) { values.push(filters.from); where.push(`comment.created_at >= $${values.length}`); }
    if (filters.to) { values.push(filters.to); where.push(`comment.created_at < $${values.length}`); }
    values.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
    const result = await this.database.query<CommentRecord & { total: string }>(
      `SELECT comment.id, comment.article_key AS "articleKey", comment.root_comment_id AS "rootCommentId", comment.author_id AS "authorId", comment.author_name AS "authorName", comment.author_avatar_url AS "authorAvatarUrl", comment.body, comment.status, comment.created_at AS "createdAt", 0::integer AS "replyCount", 0::integer AS heat, count(*) OVER()::text AS total FROM comments comment JOIN applications application ON application.id = comment.application_id WHERE ${where.join(' AND ')} ORDER BY comment.created_at DESC, comment.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const total = Number(result.rows[0]?.total ?? 0);
    return { items: result.rows.map(({ total: _total, ...comment }) => comment), page: filters.page, pageSize: filters.pageSize, total };
  }

  async delete(applicationKey: string, commentId: string, operatorId: string): Promise<void> {
    await this.database.transaction(async (database) => {
      const result = await database.query(
        `UPDATE comments comment SET status = 'deleted' FROM applications application WHERE application.id = comment.application_id AND application.key = $1 AND comment.id = $2 AND comment.status <> 'deleted'`,
        [applicationKey, commentId]
      );
      if (result.rowCount !== 1) throw new NotFoundException();
      await this.auditLogs.record(database, applicationKey, 'comment.deleted', 'comment', commentId, {}, operatorId);
    });
  }

  async bulkDeleteByArticle(applicationKey: string, articleKey: string, operatorId: string): Promise<{ deletedCount: number }> {
    return this.bulkDelete(applicationKey, `comment.article_key = $2`, articleKey, 'article', operatorId);
  }

  async bulkDeleteByUser(applicationKey: string, memberId: string, operatorId: string): Promise<{ deletedCount: number }> {
    return this.bulkDelete(applicationKey, `comment.author_id = $2`, memberId, 'user', operatorId);
  }

  private async bulkDelete(applicationKey: string, targetClause: string, targetId: string, targetType: 'article' | 'user', operatorId: string): Promise<{ deletedCount: number }> {
    return this.database.transaction(async (database) => {
      const result = await database.query(
        `UPDATE comments comment SET status = 'deleted' FROM applications application WHERE application.id = comment.application_id AND application.key = $1 AND ${targetClause} AND comment.status <> 'deleted'`,
        [applicationKey, targetId]
      );
      await this.auditLogs.record(database, applicationKey, `comments.bulk_deleted_by_${targetType}`, targetType, targetId, { deletedCount: result.rowCount ?? 0 }, operatorId);
      return { deletedCount: result.rowCount ?? 0 };
    });
  }
}