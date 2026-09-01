import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseService } from './database.service.js';
import { AuditLogsService } from './audit-logs.service.js';

export interface ApplicationRecord {
  key: string;
  slug: string;
  name: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly database: DatabaseService, private readonly auditLogs: AuditLogsService) {}

  async create(name: string, slug: string): Promise<ApplicationRecord> {
    try {
      const id = uuidv7();
      const key = uuidv7();
      const result = await this.database.query<ApplicationRecord>(
        `WITH application AS (
          INSERT INTO applications (id, key, slug, name) VALUES ($1, $2, $3, $4)
          RETURNING key::text, slug, name, status, created_at AS "createdAt", updated_at AS "updatedAt", id
        ), settings AS (
          INSERT INTO application_settings (application_id) SELECT id FROM application
        ) SELECT key, slug, name, status, "createdAt", "updatedAt" FROM application`,
        [id, key, slug, name]
      );
      return result.rows[0];
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException({ code: 'slug_taken', message: 'Application slug is already in use' });
      }
      throw error;
    }
  }

  async list(): Promise<ApplicationRecord[]> {
    const result = await this.database.query<ApplicationRecord>(
      `SELECT key::text, slug, name, status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM applications ORDER BY created_at ASC`
    );
    return result.rows;
  }

  async update(key: string, name?: string, status?: 'active' | 'disabled', operatorId?: string): Promise<ApplicationRecord> {
    const application = await this.database.transaction(async (database) => {
      const previous = await database.query<{ name: string; status: 'active' | 'disabled' }>(
        `SELECT name, status FROM applications WHERE key = $1 FOR UPDATE`,
        [key]
      );
      if (previous.rowCount !== 1) throw new NotFoundException();
      const result = await database.query<ApplicationRecord>(
        `UPDATE applications
         SET name = COALESCE($2, name), status = COALESCE($3, status), updated_at = now()
         WHERE key = $1
         RETURNING key::text, slug, name, status, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [key, name ?? null, status ?? null]
      );
      if (result.rowCount !== 1) throw new NotFoundException();
      const record = result.rows[0];
      if (status && status !== previous.rows[0].status) {
        await this.auditLogs.recordForApplicationKey(database, key, status === 'disabled' ? 'application.disabled' : 'application.enabled', 'application', key, { status }, operatorId ?? null);
      }
      if (name && name !== previous.rows[0].name) {
        await this.auditLogs.recordForApplicationKey(database, key, 'application.renamed', 'application', key, { name }, operatorId ?? null);
      }
      return record;
    });
    return application;
  }
}