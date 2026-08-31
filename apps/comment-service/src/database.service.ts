import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface DatabaseExecutor {
  query<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

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
      CREATE TABLE IF NOT EXISTS comments (
        id CHAR(26) PRIMARY KEY,
        application_id UUID NOT NULL REFERENCES applications(id),
        article_key TEXT NOT NULL,
        root_comment_id CHAR(26) REFERENCES comments(id),
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_avatar_url TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('published', 'pending', 'rejected', 'deleted')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS comments_root_list_idx
        ON comments (application_id, article_key, created_at DESC, id DESC)
        WHERE root_comment_id IS NULL AND status = 'published';
      CREATE TABLE IF NOT EXISTS comment_reactions (
        application_id UUID NOT NULL REFERENCES applications(id), comment_id CHAR(26) NOT NULL REFERENCES comments(id),
        member_id TEXT NOT NULL, emoji TEXT NOT NULL CHECK (emoji IN ('laugh', 'cry', 'cheer')),
        PRIMARY KEY (application_id, comment_id, member_id, emoji)
      );
      CREATE TABLE IF NOT EXISTS triple_reactions (
        application_id UUID NOT NULL REFERENCES applications(id), comment_id CHAR(26) NOT NULL REFERENCES comments(id),
        member_id TEXT NOT NULL, PRIMARY KEY (application_id, comment_id, member_id)
      );
      CREATE TABLE IF NOT EXISTS muted_users (
        application_id UUID NOT NULL REFERENCES applications(id), member_id TEXT NOT NULL, muted_member_id TEXT NOT NULL,
        PRIMARY KEY (application_id, member_id, muted_member_id), CHECK (member_id <> muted_member_id)
      );
      CREATE TABLE IF NOT EXISTS reports (
        id CHAR(26) PRIMARY KEY, application_id UUID NOT NULL REFERENCES applications(id), reporter_id TEXT NOT NULL,
        comment_id CHAR(26) NOT NULL REFERENCES comments(id), reported_author_id TEXT NOT NULL,
        reason_category TEXT NOT NULL CHECK (reason_category IN ('spam', 'harassment', 'hate', 'misinformation', 'sexual_content', 'violence')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (application_id, reporter_id, comment_id)
      );
      CREATE TABLE IF NOT EXISTS user_blocks (
        application_id UUID NOT NULL REFERENCES applications(id), member_id TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('normal', 'full')), source TEXT NOT NULL DEFAULT 'manual', expires_at TIMESTAMPTZ,
        PRIMARY KEY (application_id, member_id)
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

  async transaction<T>(work: (database: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}