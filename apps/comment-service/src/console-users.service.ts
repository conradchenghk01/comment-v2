import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { ConsolePage } from './console-reports.service.js';

export interface ConsoleUser { memberId: string; commentCount: number; reportCount: number; blockMode: 'normal' | 'full' | null; }

@Injectable()
export class ConsoleUsersService {
  constructor(private readonly database: DatabaseService) {}

  async list(applicationKey: string, page: number, pageSize: number): Promise<ConsolePage<ConsoleUser>> {
    const result = await this.database.query<ConsoleUser & { total: string }>(
      `WITH members AS (SELECT author_id AS member_id FROM comments WHERE application_id = (SELECT id FROM applications WHERE key = $1) UNION SELECT reported_author_id FROM reports WHERE application_id = (SELECT id FROM applications WHERE key = $1)) SELECT members.member_id AS "memberId", (SELECT count(*)::integer FROM comments comment WHERE comment.application_id = application.id AND comment.author_id = members.member_id) AS "commentCount", (SELECT count(*)::integer FROM reports report WHERE report.application_id = application.id AND report.reported_author_id = members.member_id) AS "reportCount", block.mode AS "blockMode", count(*) OVER()::text AS total FROM members JOIN applications application ON application.key = $1 LEFT JOIN user_blocks block ON block.application_id = application.id AND block.member_id = members.member_id AND (block.expires_at IS NULL OR block.expires_at > now()) ORDER BY "reportCount" DESC, "commentCount" DESC, "memberId" ASC LIMIT $2 OFFSET $3`,
      [applicationKey, pageSize, (page - 1) * pageSize]
    );
    const total = Number(result.rows[0]?.total ?? 0);
    return { items: result.rows.map(({ total: _total, ...user }) => user), page, pageSize, total };
  }

  async stats(applicationKey: string, memberId: string): Promise<ConsoleUser> {
    const result = await this.database.query<ConsoleUser>(
      `SELECT member.member_id AS "memberId", (SELECT count(*)::integer FROM comments comment WHERE comment.application_id = application.id AND comment.author_id = member.member_id) AS "commentCount", (SELECT count(*)::integer FROM reports report WHERE report.application_id = application.id AND report.reported_author_id = member.member_id) AS "reportCount", block.mode AS "blockMode" FROM applications application CROSS JOIN (SELECT $2::text AS member_id) member LEFT JOIN user_blocks block ON block.application_id = application.id AND block.member_id = member.member_id AND (block.expires_at IS NULL OR block.expires_at > now()) WHERE application.key = $1 AND EXISTS (SELECT 1 FROM comments comment WHERE comment.application_id = application.id AND comment.author_id = member.member_id UNION SELECT 1 FROM reports report WHERE report.application_id = application.id AND report.reported_author_id = member.member_id)`,
      [applicationKey, memberId]
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    return result.rows[0];
  }
}