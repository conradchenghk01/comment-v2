import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

export type Emoji = 'laugh' | 'cry' | 'cheer';
export interface ReactionState { counts: Record<Emoji, number>; active: Emoji[]; tripleUsed: boolean; }

@Injectable()
export class ReactionsService {
  constructor(private readonly database: DatabaseService) {}
  async toggle(applicationKey: string, commentId: string, memberId: string, emoji: Emoji): Promise<ReactionState> {
    const valid = await this.database.query(`SELECT 1 FROM comments c JOIN applications a ON a.id=c.application_id WHERE a.key=$1 AND a.status='active' AND c.id=$2 AND c.status='published'`, [applicationKey, commentId]);
    if (valid.rowCount !== 1) throw new NotFoundException();
    const removed = await this.database.query(`DELETE FROM comment_reactions r USING applications a WHERE a.id=r.application_id AND a.key=$1 AND r.comment_id=$2 AND r.member_id=$3 AND r.emoji=$4 RETURNING 1`, [applicationKey, commentId, memberId, emoji]);
    if (removed.rowCount === 0) await this.database.query(`INSERT INTO comment_reactions (application_id, comment_id, member_id, emoji) SELECT id,$2,$3,$4 FROM applications WHERE key=$1`, [applicationKey, commentId, memberId, emoji]);
    return this.state(applicationKey, commentId, memberId);
  }
  async triple(applicationKey: string, commentId: string, memberId: string): Promise<ReactionState> {
    try {
      const inserted = await this.database.query<{ triple_inserted: boolean }>(`WITH target AS (SELECT a.id AS application_id FROM applications a JOIN comments c ON c.application_id=a.id WHERE a.key=$1 AND a.status='active' AND c.id=$2 AND c.status='published'), triple AS (INSERT INTO triple_reactions (application_id, comment_id, member_id) SELECT application_id,$2,$3 FROM target RETURNING application_id), reactions AS (INSERT INTO comment_reactions (application_id, comment_id, member_id, emoji) SELECT triple.application_id,$2,$3,emoji FROM triple CROSS JOIN unnest(ARRAY['laugh','cry','cheer']) AS emoji ON CONFLICT DO NOTHING) SELECT EXISTS(SELECT 1 FROM triple) AS triple_inserted`, [applicationKey, commentId, memberId]);
      if (!inserted.rows[0]?.triple_inserted) throw new NotFoundException();
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException({ code: 'triple_reaction_already_used' });
    }
    return this.state(applicationKey, commentId, memberId);
  }
  private async state(applicationKey: string, commentId: string, memberId: string): Promise<ReactionState> {
    const result = await this.database.query<{ emoji: Emoji; count: string; active: boolean; triple_used: boolean }>(`SELECT e.emoji, count(r.emoji)::text AS count, bool_or(r.member_id=$3) AS active, EXISTS(SELECT 1 FROM triple_reactions t JOIN applications a2 ON a2.id=t.application_id WHERE a2.key=$1 AND t.comment_id=$2 AND t.member_id=$3) AS triple_used FROM unnest(ARRAY['laugh','cry','cheer']) AS e(emoji) LEFT JOIN comment_reactions r ON r.emoji=e.emoji AND r.comment_id=$2 GROUP BY e.emoji`, [applicationKey, commentId, memberId]);
    const counts = { laugh: 0, cry: 0, cheer: 0 }; const active: Emoji[] = [];
    for (const row of result.rows) { counts[row.emoji] = Number(row.count); if (row.active) active.push(row.emoji); }
    return { counts, active, tripleUsed: Boolean(result.rows[0]?.triple_used) };
  }
}