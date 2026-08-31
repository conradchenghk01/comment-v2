import { Injectable } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service.js';
import { DatabaseExecutor } from './database.service.js';

@Injectable()
export class AutoBanService {
  constructor(private readonly auditLogs: AuditLogsService) {}

  async evaluate(database: DatabaseExecutor, applicationId: string, memberId: string): Promise<void> {
    await database.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${applicationId}:${memberId}`]);
    const reports = await database.query<{ count: string }>(`SELECT count(*)::text AS count FROM reports WHERE application_id = $1 AND reported_author_id = $2 AND created_at >= now() - interval '24 hours'`, [applicationId, memberId]);
    const state = await database.query<{ trigger_count: number; threshold_one: number; threshold_two: number; threshold_three: number }>(`SELECT COALESCE(offense.trigger_count, 0)::integer AS trigger_count, settings.auto_ban_threshold_one AS threshold_one, settings.auto_ban_threshold_two AS threshold_two, settings.auto_ban_threshold_three AS threshold_three FROM application_settings settings LEFT JOIN user_offenses offense ON offense.application_id = settings.application_id AND offense.member_id = $2 WHERE settings.application_id = $1`, [applicationId, memberId]);
    const current = state.rows[0];
    const threshold = current.trigger_count === 0 ? current.threshold_one : current.trigger_count === 1 ? current.threshold_two : current.threshold_three;
    if (Number(reports.rows[0]?.count ?? 0) < threshold) return;
    const offense = await database.query<{ trigger_count: number }>(`INSERT INTO user_offenses (application_id, member_id, trigger_count) VALUES ($1, $2, 1) ON CONFLICT (application_id, member_id) DO UPDATE SET trigger_count = user_offenses.trigger_count + 1 RETURNING trigger_count`, [applicationId, memberId]);
    const count = offense.rows[0].trigger_count;
    const mode = count >= 4 ? 'full' : 'normal';
    const expiresAt = count === 1 ? "now() + interval '1 day'" : count === 2 ? "now() + interval '1 week'" : count === 3 ? "now() + interval '1 month'" : 'NULL';
    await database.query(`INSERT INTO user_blocks (application_id, member_id, mode, source, expires_at) VALUES ($1, $2, $3, 'auto', ${expiresAt}) ON CONFLICT (application_id, member_id) DO UPDATE SET mode = EXCLUDED.mode, source = 'auto', expires_at = EXCLUDED.expires_at WHERE user_blocks.source = 'auto' OR user_blocks.expires_at <= now()`, [applicationId, memberId, mode]);
    await this.auditLogs.recordForApplicationId(database, applicationId, 'user.auto_banned', 'user', memberId, { triggerCount: count, reportCount: Number(reports.rows[0]?.count ?? 0), mode });
  }
}