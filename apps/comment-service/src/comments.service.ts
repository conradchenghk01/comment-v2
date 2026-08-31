import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { DatabaseExecutor, DatabaseService } from './database.service.js';
import { MemberIdentity } from './local-member.guard.js';

export interface CommentRecord {
  id: string;
  articleKey: string;
  rootCommentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  body: string;
  status: string;
  createdAt: string;
  replyCount: number;
  heat: number;
}

export type CommentSort = 'relevant' | 'newest' | 'oldest';
export interface CommentPage { items: CommentRecord[]; nextCursor: string | null; }
interface CommentCursor { createdAt: string; id: string; heat?: number; }
interface DatabaseCommentRecord extends CommentRecord { cursorCreatedAt?: string; }

@Injectable()
export class CommentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(applicationKey: string, articleKey: string, body: string, member: MemberIdentity): Promise<CommentRecord> {
    this.validateBody(body);
    return this.withTransaction(async (database) => {
      await this.assertPostingAllowed(database, applicationKey, member);
      const result = await database.query<CommentRecord>(
      `INSERT INTO comments (id, application_id, article_key, author_id, author_name, author_avatar_url, body, status)
       SELECT $1, id, $3, $4, $5, $6, $7, 'published' FROM applications WHERE key = $2 AND status = 'active'
        RETURNING id, article_key AS "articleKey", root_comment_id AS "rootCommentId", author_id AS "authorId", author_name AS "authorName", author_avatar_url AS "authorAvatarUrl", body, status, created_at AS "createdAt", 0::integer AS "replyCount", 0::integer AS heat`,
      [ulid(), applicationKey, articleKey, member.accountId, member.name, member.avatarUrl, body]
      );
      if (result.rowCount !== 1) throw new NotFoundException();
      return result.rows[0];
    });
  }

  async list(applicationKey: string, articleKey: string, sort: CommentSort = 'relevant', cursor: string | undefined, limit = 20): Promise<CommentPage> {
    const parsedCursor = this.parseCursor(cursor, sort);
    const orderBy = sort === 'relevant' ? 'heat DESC, "createdAt" DESC, id DESC' : sort === 'newest' ? '"createdAt" DESC, id DESC' : '"createdAt" ASC, id ASC';
    const values: unknown[] = [applicationKey, articleKey];
    let cursorClause = '';
    if (parsedCursor) {
      if (sort === 'relevant') {
        values.push(parsedCursor.heat, parsedCursor.createdAt, parsedCursor.id);
        cursorClause = 'AND (heat, "createdAt", id) < ($3, $4, $5)';
      } else {
        values.push(parsedCursor.createdAt, parsedCursor.id);
        cursorClause = sort === 'newest' ? 'AND ("createdAt", id) < ($3, $4)' : 'AND ("createdAt", id) > ($3, $4)';
      }
    }
    values.push(limit + 1);
    const result = await this.database.query<DatabaseCommentRecord>(
      `WITH roots AS (SELECT c.id, c.article_key AS "articleKey", c.root_comment_id AS "rootCommentId", c.author_id AS "authorId", c.author_name AS "authorName", c.author_avatar_url AS "authorAvatarUrl", c.body, c.status, c.created_at AS "createdAt", c.created_at::text AS "cursorCreatedAt", (SELECT count(*)::integer FROM comments child WHERE child.root_comment_id = c.id AND child.status = 'published') AS "replyCount", (SELECT count(*)::integer FROM comment_reactions reaction WHERE reaction.comment_id = c.id) AS reactions FROM comments c JOIN applications a ON a.id = c.application_id WHERE a.key = $1 AND a.status = 'active' AND c.article_key = $2 AND c.root_comment_id IS NULL AND c.status = 'published'), stats AS (SELECT roots.*, ("replyCount" + reactions) AS heat FROM roots) SELECT id, "articleKey", "rootCommentId", "authorId", "authorName", "authorAvatarUrl", body, status, "createdAt", "cursorCreatedAt", "replyCount", heat FROM stats WHERE true ${cursorClause} ORDER BY ${orderBy} LIMIT $${values.length}`,
      values
    );
    return this.page(result.rows, limit, sort);
  }

  async reply(applicationKey: string, rootCommentId: string, body: string, member: MemberIdentity): Promise<CommentRecord> {
    this.validateBody(body);
    return this.withTransaction(async (database) => {
      await this.assertPostingAllowed(database, applicationKey, member);
      const result = await database.query<CommentRecord>(
      `INSERT INTO comments (id, application_id, article_key, root_comment_id, author_id, author_name, author_avatar_url, body, status)
       SELECT $1, parent.application_id, parent.article_key, parent.id, $4, $5, $6, $7, 'published'
       FROM comments parent JOIN applications ON applications.id = parent.application_id
       WHERE applications.key = $2 AND applications.status = 'active' AND parent.id = $3 AND parent.root_comment_id IS NULL AND parent.status = 'published'
        RETURNING id, article_key AS "articleKey", root_comment_id AS "rootCommentId", author_id AS "authorId", author_name AS "authorName", author_avatar_url AS "authorAvatarUrl", body, status, created_at AS "createdAt", 0::integer AS "replyCount", 0::integer AS heat`,
      [ulid(), applicationKey, rootCommentId, member.accountId, member.name, member.avatarUrl, body]
      );
      if (result.rowCount !== 1) throw new NotFoundException();
      return result.rows[0];
    });
  }

  async branch(applicationKey: string, rootCommentId: string, cursor: string | undefined, limit = 20): Promise<CommentPage> {
    const parsedCursor = this.parseCursor(cursor, 'oldest');
    const values: unknown[] = [applicationKey, rootCommentId];
    let cursorClause = '';
    if (parsedCursor) { values.push(parsedCursor.createdAt, parsedCursor.id); cursorClause = 'AND (child.created_at, child.id) > ($3, $4)'; }
    values.push(limit + 1);
    const result = await this.database.query<DatabaseCommentRecord>(
      `SELECT child.id, child.article_key AS "articleKey", child.root_comment_id AS "rootCommentId", child.author_id AS "authorId", child.author_name AS "authorName", child.author_avatar_url AS "authorAvatarUrl", child.body, child.status, child.created_at AS "createdAt", child.created_at::text AS "cursorCreatedAt", 0::integer AS "replyCount", (SELECT count(*)::integer FROM comment_reactions reaction WHERE reaction.comment_id = child.id) AS heat
       FROM comments child JOIN applications ON applications.id = child.application_id
       WHERE applications.key = $1 AND applications.status = 'active' AND child.root_comment_id = $2 AND child.status = 'published' ${cursorClause}
       ORDER BY child.created_at ASC, child.id ASC LIMIT $${values.length}`,
      values
    );
    return this.page(result.rows, limit, 'oldest');
  }

  private page(rows: DatabaseCommentRecord[], limit: number, sort: CommentSort): CommentPage {
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    const items = pageRows.map(({ cursorCreatedAt: _cursorCreatedAt, ...comment }) => comment);
    return { items, nextCursor: rows.length > limit && last ? this.encodeCursor(last, sort) : null };
  }

  private parseCursor(cursor: string | undefined, sort: CommentSort): CommentCursor | undefined {
    if (!cursor) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CommentCursor;
      if (!parsed.id || !parsed.createdAt || (sort === 'relevant' && !Number.isInteger(parsed.heat))) throw new Error('invalid cursor');
      return parsed;
    } catch { throw new BadRequestException({ code: 'cursor_invalid', message: 'Cursor is invalid' }); }
  }

  private encodeCursor(comment: DatabaseCommentRecord, sort: CommentSort): string {
    const createdAt = comment.cursorCreatedAt ?? new Date(comment.createdAt).toISOString();
    return Buffer.from(JSON.stringify(sort === 'relevant' ? { id: comment.id, createdAt, heat: comment.heat } : { id: comment.id, createdAt })).toString('base64url');
  }

  private async assertPostingAllowed(database: DatabaseExecutor, applicationKey: string, member: MemberIdentity): Promise<void> {
    const settings = await database.query<{ application_id: string; comment_interval_seconds: number; daily_comment_limit: number; new_user_cooldown_hours: number }>(
      `SELECT application.id AS application_id, settings.comment_interval_seconds, settings.daily_comment_limit, settings.new_user_cooldown_hours FROM applications application JOIN application_settings settings ON settings.application_id = application.id WHERE application.key = $1 AND application.status = 'active' FOR UPDATE`,
      [applicationKey]
    );
    if (settings.rowCount !== 1) throw new NotFoundException();
    const rules = settings.rows[0];
    const cooldownEndsAt = new Date(new Date(member.createdAt).getTime() + rules.new_user_cooldown_hours * 3_600_000);
    if (cooldownEndsAt > new Date()) throw this.rateLimitExceeded({ code: 'new_user_cooldown_active', message: 'New-user cooldown is active', details: { cooldownEndsAt: cooldownEndsAt.toISOString() } });
    const lastComment = await database.query<{ created_at: Date }>(
      `SELECT created_at FROM comments WHERE application_id = $1 AND author_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [rules.application_id, member.accountId]
    );
    const lastCreatedAt = lastComment.rows[0]?.created_at;
    if (lastCreatedAt) {
      const retryAfterSeconds = Math.ceil((new Date(lastCreatedAt).getTime() + rules.comment_interval_seconds * 1_000 - Date.now()) / 1_000);
      if (retryAfterSeconds > 0) throw this.rateLimitExceeded({ code: 'comment_interval_active', message: 'Comment interval is active', details: { retryAfterSeconds } });
    }
    const daily = await database.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM comments WHERE application_id = $1 AND author_id = $2 AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Hong_Kong') AT TIME ZONE 'Asia/Hong_Kong')`,
      [rules.application_id, member.accountId]
    );
    if (Number(daily.rows[0]?.count ?? 0) >= rules.daily_comment_limit) throw this.rateLimitExceeded({ code: 'daily_comment_limit_exceeded', message: 'Daily comment limit is exhausted', details: { remainingDailyQuota: 0 } });
  }

  private withTransaction<T>(work: (database: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }

  private rateLimitExceeded(response: Record<string, unknown>): HttpException {
    return new HttpException(response, HttpStatus.TOO_MANY_REQUESTS);
  }

  private validateBody(body: string): void {
    if (!body.trim()) throw new BadRequestException({ code: 'comment_body_blank', message: 'Comment body cannot be blank' });
    const count = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(body)].length;
    if (count > 1000) throw new BadRequestException({ code: 'comment_body_too_long', message: 'Comment body is limited to 1000 characters' });
  }
}