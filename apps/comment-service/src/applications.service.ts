import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseService } from './database.service.js';

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
  constructor(private readonly database: DatabaseService) {}

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

  async update(key: string, name?: string, status?: 'active' | 'disabled'): Promise<ApplicationRecord> {
    const result = await this.database.query<ApplicationRecord>(
      `UPDATE applications
       SET name = COALESCE($2, name), status = COALESCE($3, status), updated_at = now()
       WHERE key = $1
       RETURNING key::text, slug, name, status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [key, name ?? null, status ?? null]
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    return result.rows[0];
  }
}