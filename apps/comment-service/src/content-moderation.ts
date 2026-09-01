import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

export interface ModerationVerdict { flagged: boolean; }

/** Injection token so CommentsService can receive the adapter despite interface erasure. */
export const CONTENT_MODERATION_ADAPTER = Symbol('CONTENT_MODERATION_ADAPTER');

/**
 * Synchronous content-moderation boundary for comment creation.
 * The v1 implementation matches the application's console-managed sensitive
 * words locally; when Yidun credentials are provided this adapter is replaced
 * by the SaaS implementation (ADR-0001) while keeping this contract stable.
 */
export interface ContentModerationAdapter {
  review(applicationKey: string, body: string): Promise<ModerationVerdict>;
}

@Injectable()
export class SensitiveWordsModerationAdapter implements ContentModerationAdapter {
  constructor(private readonly database: DatabaseService) {}

  async review(applicationKey: string, body: string): Promise<ModerationVerdict> {
    const result = await this.database.query<{ flagged: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM sensitive_words word
         JOIN applications application ON application.id = word.application_id
         WHERE application.key = $1 AND $2 ILIKE '%' || word.normalized_word || '%'
       ) AS flagged`,
      [applicationKey, body]
    );
    return { flagged: Boolean(result.rows[0]?.flagged) };
  }
}
