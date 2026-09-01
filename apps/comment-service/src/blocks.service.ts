import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { AuditLogsService } from './audit-logs.service.js';

export type BlockMode = 'normal' | 'full';

@Injectable()
export class BlocksService {
  constructor(private readonly database: DatabaseService, private readonly auditLogs: AuditLogsService) {}
  async set(applicationKey: string, memberId: string, mode: BlockMode, operatorId: string, note?: string): Promise<void> {
    await this.database.transaction(async (database) => {
      const result = await database.query(`INSERT INTO user_blocks (application_id, member_id, mode) SELECT id, $2, $3 FROM applications WHERE key = $1 ON CONFLICT (application_id, member_id) DO UPDATE SET mode = EXCLUDED.mode, source = 'manual', expires_at = NULL`, [applicationKey, memberId, mode]);
      if (result.rowCount !== 1) throw new NotFoundException();
      const metadata: Record<string, unknown> = { mode };
      if (note) metadata.note = note;
      await this.auditLogs.record(database, applicationKey, 'user.blocked', 'user', memberId, metadata, operatorId);
    });
  }
  async remove(applicationKey: string, memberId: string, operatorId: string, note?: string): Promise<void> {
    await this.database.transaction(async (database) => {
      const result = await database.query(`DELETE FROM user_blocks block USING applications application WHERE application.id = block.application_id AND application.key = $1 AND block.member_id = $2`, [applicationKey, memberId]);
      if (result.rowCount !== 1) throw new NotFoundException();
      const metadata: Record<string, unknown> = {};
      if (note) metadata.note = note;
      await this.auditLogs.record(database, applicationKey, 'user.unblocked', 'user', memberId, metadata, operatorId);
    });
  }
  async active(applicationKey: string, memberId: string): Promise<BlockMode | undefined> {
    const result = await this.database.query<{ mode: BlockMode }>(`SELECT block.mode FROM user_blocks block JOIN applications application ON application.id = block.application_id WHERE application.key = $1 AND block.member_id = $2 AND (block.expires_at IS NULL OR block.expires_at > now())`, [applicationKey, memberId]);
    return result.rows[0]?.mode;
  }
}