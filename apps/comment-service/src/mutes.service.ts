import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Injectable()
export class MutesService {
  constructor(private readonly database: DatabaseService) {}

  async mute(applicationKey: string, memberId: string, mutedMemberId: string): Promise<void> {
    if (memberId === mutedMemberId) throw new BadRequestException({ code: 'cannot_mute_self', message: 'A member cannot mute themselves' });
    const result = await this.database.query(
      `INSERT INTO muted_users (application_id, member_id, muted_member_id) SELECT id, $2, $3 FROM applications WHERE key = $1 AND status = 'active' ON CONFLICT DO NOTHING`,
      [applicationKey, memberId, mutedMemberId]
    );
    if (result.rowCount === 0) {
      const application = await this.database.query('SELECT 1 FROM applications WHERE key = $1 AND status = $2', [applicationKey, 'active']);
      if (application.rowCount !== 1) throw new NotFoundException();
    }
  }

  async unmute(applicationKey: string, memberId: string, mutedMemberId: string): Promise<void> {
    const result = await this.database.query(
      `DELETE FROM muted_users mute USING applications application WHERE application.id = mute.application_id AND application.key = $1 AND mute.member_id = $2 AND mute.muted_member_id = $3`,
      [applicationKey, memberId, mutedMemberId]
    );
    if (result.rowCount === 0) throw new NotFoundException();
  }
}