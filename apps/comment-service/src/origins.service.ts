import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Injectable()
export class OriginsService {
  constructor(private readonly database: DatabaseService) {}

  async list(applicationKey: string): Promise<string[]> {
    const result = await this.database.query<{ origin: string }>(`SELECT origin.origin FROM application_origins origin JOIN applications application ON application.id = origin.application_id WHERE application.key = $1 ORDER BY origin.origin ASC`, [applicationKey]);
    return result.rows.map((row) => row.origin);
  }

  async add(applicationKey: string, origin: string): Promise<void> {
    const result = await this.database.query(`INSERT INTO application_origins (application_id, origin) SELECT id, $2 FROM applications WHERE key = $1 ON CONFLICT DO NOTHING`, [applicationKey, origin]);
    if (result.rowCount === 0) {
      const application = await this.database.query(`SELECT 1 FROM applications WHERE key = $1`, [applicationKey]);
      if (application.rowCount === 0) throw new NotFoundException();
      throw new ConflictException({ code: 'origin_already_allowed', message: 'Origin is already allowed' });
    }
  }

  async remove(applicationKey: string, origin: string): Promise<void> {
    const result = await this.database.query(`DELETE FROM application_origins origin USING applications application WHERE application.id = origin.application_id AND application.key = $1 AND origin.origin = $2`, [applicationKey, origin]);
    if (result.rowCount !== 1) throw new NotFoundException();
  }

  async isAllowed(applicationKey: string, origin: string): Promise<boolean> {
    const result = await this.database.query(`SELECT 1 FROM application_origins origin JOIN applications application ON application.id = origin.application_id WHERE application.key = $1 AND origin.origin = $2`, [applicationKey, origin]);
    return result.rows.length > 0;
  }

  async isRegistered(origin: string): Promise<boolean> {
    const result = await this.database.query(`SELECT 1 FROM application_origins WHERE origin = $1`, [origin]);
    return result.rows.length > 0;
  }
}