import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ulid } from 'ulid';
import { CacheService } from './cache.service.js';
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
export interface BatchArticleComments { articleKey: string; comments: CommentRecord[]; commentCount: number; reactionCounts: Record<'laugh' | 'cry' | 'cheer', number>; }
export interface HotArticle { articleKey: string; commentCount: number; reactionCount: number; heat: number; }
interface CommentCursor { createdAt: string; id: string; heat?: number; }
interface DatabaseCommentRecord extends CommentRecord { cursorCreatedAt?: string; }

@Injectable()
export class CommentsService {
  constructor(private readonly database: DatabaseService, @Optional() private readonly cache?: CacheService) {}

  async create(applicationKey: string, articleKey: string, body: string, member: MemberIdentity, idempotencyKey?: string): Promise<CommentRecord> {
    this.validateBody(body);
    try { const comment = await this.withTransaction(async (database) => {
      const replay = await this.replay(database, applicationKey, member.accountId, idempotencyKey);
      if (replay) return replay;
      await this.assertPostingAllowed(database, applicationKey, member);
      const result = await database.query<CommentRecord>(
      `INSERT INTO comments (id, application_id, article_key, author_id, author_name, author_avatar_url, body, status)
       SELECT $1, id, $3, $4, $5, $6, $7, 'published' FROM applications WHERE key = $2 AND status = 'active'
        RETURNING id, article_key AS "articleKey", root_comment_id AS "rootCommentId", author_id AS "authorId", author_name AS "authorName", author_avatar_url AS "authorAvatarUrl", body, status, created_at AS "createdAt", 0::integer AS "replyCount", 0::integer AS heat`,
      [ulid(), applicationKey, articleKey, member.accountId, member.name, member.avatarUrl, body]
      );
      if (result.rowCount !== 1) throw new NotFoundException();
      await this.remember(database, applicationKey, member.accountId, idempotencyKey, result.rows[0].id);
      return result.rows[0];
    }); await this.cache?.invalidateHotArticles(applicationKey); return comment; } catch (error: unknown) { return this.replayAfterConflict(applicationKey, member.accountId, idempotencyKey, error); }
  }

  async list(applicationKey: string, articleKey: string, memberId: string, sort: CommentSort = 'relevant', cursor: string | undefined, limit = 20): Promise<CommentPage> {
    const parsedCursor = this.parseCursor(cursor, sort);
    const orderBy = sort === 'relevant' ? 'heat DESC, "createdAt" DESC, id DESC' : sort === 'newest' ? '"createdAt" DESC, id DESC' : '"createdAt" ASC, id ASC';
    const values: unknown[] = [applicationKey, articleKey, memberId];
    let cursorClause = '';
    if (parsedCursor) {
      if (sort === 'relevant') {
        values.push(parsedCursor.heat, parsedCursor.createdAt, parsedCursor.id);
        cursorClause = 'AND (heat, "createdAt", id) < ($4, $5, $6)';
      } else {
        values.push(parsedCursor.createdAt, parsedCursor.id);
        cursorClause = sort === 'newest' ? 'AND ("createdAt", id) < ($4, $5)' : 'AND ("createdAt", id) > ($4, $5)';
      }
    }
    values.push(limit + 1);
    const result = await this.database.query<DatabaseCommentRecord>(
      `WITH roots AS (SELECT c.id, c.article_key AS "articleKey", c.root_comment_id AS "rootCommentId", c.author_id AS "authorId", c.author_name AS "authorName", c.author_avatar_url AS "authorAvatarUrl", CASE WHEN c.status = 'deleted' THEN '此評論已被 01 管理員刪除' ELSE c.body END AS body, c.status, c.created_at AS "createdAt", c.created_at::text AS "cursorCreatedAt", (SELECT count(*)::integer FROM comments child WHERE child.root_comment_id = c.id AND child.status = 'published') AS "replyCount", CASE WHEN c.status = 'deleted' THEN 0 ELSE (SELECT count(*)::integer FROM comment_reactions reaction WHERE reaction.comment_id = c.id) END AS reactions FROM comments c JOIN applications a ON a.id = c.application_id WHERE a.key = $1 AND a.status = 'active' AND c.article_key = $2 AND c.root_comment_id IS NULL AND c.status IN ('published', 'deleted') AND NOT EXISTS (SELECT 1 FROM muted_users mute WHERE mute.application_id = c.application_id AND mute.member_id = $3 AND mute.muted_member_id = c.author_id) AND NOT EXISTS (SELECT 1 FROM reports report WHERE report.application_id = c.application_id AND report.reporter_id = $3 AND report.comment_id = c.id)), stats AS (SELECT roots.*, ("replyCount" + reactions) AS heat FROM roots) SELECT id, "articleKey", "rootCommentId", "authorId", "authorName", "authorAvatarUrl", body, status, "createdAt", "cursorCreatedAt", "replyCount", heat FROM stats WHERE true ${cursorClause} ORDER BY ${orderBy} LIMIT $${values.length}`,
      values
    );
    return this.page(result.rows, limit, sort);
  }

  async reply(applicationKey: string, rootCommentId: string, body: string, member: MemberIdentity, idempotencyKey?: string): Promise<CommentRecord> {
    this.validateBody(body);
    try { const comment = await this.withTransaction(async (database) => {
      const replay = await this.replay(database, applicationKey, member.accountId, idempotencyKey);
      if (replay) return replay;
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
      await this.remember(database, applicationKey, member.accountId, idempotencyKey, result.rows[0].id);
      return result.rows[0];
    }); await this.cache?.invalidateHotArticles(applicationKey); return comment; } catch (error: unknown) { return this.replayAfterConflict(applicationKey, member.accountId, idempotencyKey, error); }
  }

  async branch(applicationKey: string, rootCommentId: string, memberId: string, cursor: string | undefined, limit = 20): Promise<CommentPage> {
    const parsedCursor = this.parseCursor(cursor, 'oldest');
    const values: unknown[] = [applicationKey, rootCommentId, memberId];
    let cursorClause = '';
    if (parsedCursor) { values.push(parsedCursor.createdAt, parsedCursor.id); cursorClause = 'AND (child.created_at, child.id) > ($4, $5)'; }
    values.push(limit + 1);
    const result = await this.database.query<DatabaseCommentRecord>(
      `SELECT child.id, child.article_key AS "articleKey", child.root_comment_id AS "rootCommentId", child.author_id AS "authorId", child.author_name AS "authorName", child.author_avatar_url AS "authorAvatarUrl", child.body, child.status, child.created_at AS "createdAt", child.created_at::text AS "cursorCreatedAt", 0::integer AS "replyCount", (SELECT count(*)::integer FROM comment_reactions reaction WHERE reaction.comment_id = child.id) AS heat
       FROM comments child JOIN applications ON applications.id = child.application_id
      WHERE applications.key = $1 AND applications.status = 'active' AND child.root_comment_id = $2 AND child.status = 'published' AND NOT EXISTS (SELECT 1 FROM muted_users mute WHERE mute.application_id = child.application_id AND mute.member_id = $3 AND mute.muted_member_id = child.author_id) AND NOT EXISTS (SELECT 1 FROM reports report WHERE report.application_id = child.application_id AND report.reporter_id = $3 AND report.comment_id = child.id) ${cursorClause}
       ORDER BY child.created_at ASC, child.id ASC LIMIT $${values.length}`,
      values
    );
    return this.page(result.rows, limit, 'oldest');
  }

  async batch(applicationKey: string, memberId: string, articleKeys: string[]): Promise<{ items: BatchArticleComments[] }> {
    const result = await this.database.query<CommentRecord & { articleKey: string; commentCount: string; laughCount: string; cryCount: string; cheerCount: string; rank: string }>(
      `WITH scoped AS (SELECT comment.id, comment.article_key AS "articleKey", comment.root_comment_id AS "rootCommentId", comment.author_id AS "authorId", comment.author_name AS "authorName", comment.author_avatar_url AS "authorAvatarUrl", comment.body, comment.status, comment.created_at AS "createdAt", (SELECT count(*)::integer FROM comments child WHERE child.root_comment_id = comment.id AND child.status = 'published') AS "replyCount", (SELECT count(*)::integer FROM comment_reactions reaction WHERE reaction.comment_id = comment.id) AS heat, row_number() OVER (PARTITION BY comment.article_key ORDER BY comment.created_at DESC, comment.id DESC)::text AS rank FROM comments comment JOIN applications application ON application.id = comment.application_id WHERE application.key = $1 AND application.status = 'active' AND comment.article_key = ANY($2::text[]) AND comment.root_comment_id IS NULL AND comment.status = 'published' AND NOT EXISTS (SELECT 1 FROM muted_users mute WHERE mute.application_id = comment.application_id AND mute.member_id = $3 AND mute.muted_member_id = comment.author_id) AND NOT EXISTS (SELECT 1 FROM reports report WHERE report.application_id = comment.application_id AND report.reporter_id = $3 AND report.comment_id = comment.id)), totals AS (SELECT comment.article_key AS "articleKey", count(DISTINCT comment.id)::text AS "commentCount", count(reaction.emoji) FILTER (WHERE reaction.emoji = 'laugh')::text AS "laughCount", count(reaction.emoji) FILTER (WHERE reaction.emoji = 'cry')::text AS "cryCount", count(reaction.emoji) FILTER (WHERE reaction.emoji = 'cheer')::text AS "cheerCount" FROM comments comment JOIN applications application ON application.id = comment.application_id LEFT JOIN comment_reactions reaction ON reaction.comment_id = comment.id WHERE application.key = $1 AND application.status = 'active' AND comment.article_key = ANY($2::text[]) AND comment.status = 'published' GROUP BY comment.article_key) SELECT scoped.*, totals."commentCount", totals."laughCount", totals."cryCount", totals."cheerCount" FROM scoped JOIN totals USING ("articleKey") WHERE scoped.rank::integer <= 3 ORDER BY scoped."articleKey", scoped."createdAt" DESC, scoped.id DESC`,
      [applicationKey, articleKeys, memberId]
    );
    const byArticle = new Map<string, BatchArticleComments>();
    for (const articleKey of articleKeys) byArticle.set(articleKey, { articleKey, comments: [], commentCount: 0, reactionCounts: { laugh: 0, cry: 0, cheer: 0 } });
    for (const row of result.rows) {
      const item = byArticle.get(row.articleKey)!;
      item.commentCount = Number(row.commentCount);
      item.reactionCounts = { laugh: Number(row.laughCount), cry: Number(row.cryCount), cheer: Number(row.cheerCount) };
      const { commentCount: _commentCount, laughCount: _laughCount, cryCount: _cryCount, cheerCount: _cheerCount, rank: _rank, ...comment } = row;
      item.comments.push(comment);
    }
    return { items: articleKeys.map((articleKey) => byArticle.get(articleKey)!) };
  }

  async hotArticles(applicationKey: string, limit = 20): Promise<{ items: HotArticle[] }> {
    const cached = await this.cache?.getHotArticles(applicationKey, limit);
    if (cached) return { items: cached };
    const result = await this.database.query<HotArticle>(
      `SELECT comment.article_key AS "articleKey", count(DISTINCT comment.id)::integer AS "commentCount", count(reaction.emoji)::integer AS "reactionCount", (count(DISTINCT comment.id) + count(reaction.emoji))::integer AS heat FROM comments comment JOIN applications application ON application.id = comment.application_id LEFT JOIN comment_reactions reaction ON reaction.comment_id = comment.id WHERE application.key = $1 AND application.status = 'active' AND comment.status = 'published' GROUP BY comment.article_key ORDER BY heat DESC, "articleKey" ASC LIMIT $2`,
      [applicationKey, limit]
    );
    await this.cache?.setHotArticles(applicationKey, limit, result.rows);
    return { items: result.rows };
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

  private async replay(database: DatabaseExecutor, applicationKey: string, memberId: string, key: string | undefined): Promise<CommentRecord | undefined> {
    if (!key) return undefined;
    const result = await database.query<CommentRecord>(`SELECT comment.id, comment.article_key AS "articleKey", comment.root_comment_id AS "rootCommentId", comment.author_id AS "authorId", comment.author_name AS "authorName", comment.author_avatar_url AS "authorAvatarUrl", comment.body, comment.status, comment.created_at AS "createdAt", 0::integer AS "replyCount", 0::integer AS heat FROM comment_idempotency_keys idempotency JOIN applications application ON application.id = idempotency.application_id JOIN comments comment ON comment.id = idempotency.comment_id WHERE application.key = $1 AND idempotency.member_id = $2 AND idempotency.key = $3`, [applicationKey, memberId, key]);
    return result.rows[0];
  }

  private async remember(database: DatabaseExecutor, applicationKey: string, memberId: string, key: string | undefined, commentId: string): Promise<void> {
    if (!key) return;
    await database.query(`INSERT INTO comment_idempotency_keys (application_id, member_id, key, comment_id) SELECT id, $2, $3, $4 FROM applications WHERE key = $1`, [applicationKey, memberId, key, commentId]);
  }

  private async replayAfterConflict(applicationKey: string, memberId: string, key: string | undefined, error: unknown): Promise<CommentRecord> {
    if (!key || !(typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')) throw error;
    const replay = await this.replay(this.database, applicationKey, memberId, key);
    if (!replay) throw error;
    return replay;
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