import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { DatabaseService } from './database.service.js';
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
}

@Injectable()
export class CommentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(applicationKey: string, articleKey: string, body: string, member: MemberIdentity): Promise<CommentRecord> {
    this.validateBody(body);
    const result = await this.database.query<CommentRecord>(
      `INSERT INTO comments (id, application_id, article_key, author_id, author_name, author_avatar_url, body, status)
       SELECT $1, id, $3, $4, $5, $6, $7, 'published' FROM applications WHERE key = $2 AND status = 'active'
       RETURNING id, article_key AS "articleKey", root_comment_id AS "rootCommentId", author_id AS "authorId", author_name AS "authorName", author_avatar_url AS "authorAvatarUrl", body, status, created_at AS "createdAt"`,
      [ulid(), applicationKey, articleKey, member.accountId, member.name, member.avatarUrl, body]
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    return result.rows[0];
  }

  async list(applicationKey: string, articleKey: string, limit = 20): Promise<CommentRecord[]> {
    const result = await this.database.query<CommentRecord>(
      `SELECT comments.id, comments.article_key AS "articleKey", comments.root_comment_id AS "rootCommentId", comments.author_id AS "authorId", comments.author_name AS "authorName", comments.author_avatar_url AS "authorAvatarUrl", comments.body, comments.status, comments.created_at AS "createdAt"
       FROM comments JOIN applications ON applications.id = comments.application_id
       WHERE applications.key = $1 AND applications.status = 'active' AND comments.article_key = $2 AND comments.root_comment_id IS NULL AND comments.status = 'published'
       ORDER BY comments.created_at DESC, comments.id DESC LIMIT $3`,
      [applicationKey, articleKey, limit]
    );
    return result.rows;
  }

  private validateBody(body: string): void {
    if (!body.trim()) throw new BadRequestException({ code: 'comment_body_blank', message: 'Comment body cannot be blank' });
    const count = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(body)].length;
    if (count > 1000) throw new BadRequestException({ code: 'comment_body_too_long', message: 'Comment body is limited to 1000 characters' });
  }
}