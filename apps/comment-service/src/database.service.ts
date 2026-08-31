import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS local_operators (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY,
        key UUID NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 32),
        name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS application_settings (
        application_id UUID PRIMARY KEY REFERENCES applications(id),
        comment_interval_seconds INTEGER NOT NULL DEFAULT 60,
        daily_comment_limit INTEGER NOT NULL DEFAULT 20,
        new_user_cooldown_hours INTEGER NOT NULL DEFAULT 24,
        yidun_moderation_enabled BOOLEAN NOT NULL DEFAULT false
      );
    `);

    if (process.env.APP_ENV === 'local') {
      const username = process.env.LOCAL_OPERATOR_USERNAME ?? 'operator';
      const password = process.env.LOCAL_OPERATOR_PASSWORD ?? 'change-me-local-only';
      const passwordHash = await bcrypt.hash(password, 12);
      await this.pool.query(
        `INSERT INTO local_operators (username, password_hash) VALUES ($1, $2)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [username, passwordHash]
      );
    }
  }

  query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    return this.pool.query<T>(text, values);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}