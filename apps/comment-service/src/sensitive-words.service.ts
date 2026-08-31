import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { AuditLogsService } from './audit-logs.service.js';
import { DatabaseService } from './database.service.js';

export interface SensitiveWord { id: string; word: string; createdAt: string; }

@Injectable()
export class SensitiveWordsService {
  constructor(private readonly database: DatabaseService, private readonly auditLogs: AuditLogsService) {}

  async list(applicationKey: string): Promise<SensitiveWord[]> {
    const result = await this.database.query<SensitiveWord>(`SELECT word.id, word.normalized_word AS word, word.created_at AS "createdAt" FROM sensitive_words word JOIN applications application ON application.id = word.application_id WHERE application.key = $1 ORDER BY word.normalized_word ASC`, [applicationKey]);
    return result.rows;
  }

  async add(applicationKey: string, word: string): Promise<SensitiveWord> {
    const normalizedWord = this.normalize(word);
    return this.database.transaction(async (database) => {
      const result = await database.query<SensitiveWord>(`INSERT INTO sensitive_words (id, application_id, normalized_word) SELECT $1, id, $3 FROM applications WHERE key = $2 ON CONFLICT (application_id, normalized_word) DO NOTHING RETURNING id, normalized_word AS word, created_at AS "createdAt"`, [ulid(), applicationKey, normalizedWord]);
      if (result.rowCount === 0) {
        const application = await database.query(`SELECT 1 FROM applications WHERE key = $1`, [applicationKey]);
        if (application.rows.length === 0) throw new NotFoundException();
        throw new ConflictException({ code: 'sensitive_word_exists', message: 'Sensitive word already exists' });
      }
      await this.auditLogs.record(database, applicationKey, 'sensitive_word.added', 'sensitive_word', result.rows[0].id, { word: normalizedWord });
      return result.rows[0];
    });
  }

  async remove(applicationKey: string, wordId: string): Promise<void> {
    await this.database.transaction(async (database) => {
      const result = await database.query<{ word: string }>(`DELETE FROM sensitive_words word USING applications application WHERE word.application_id = application.id AND application.key = $1 AND word.id = $2 RETURNING word.normalized_word AS word`, [applicationKey, wordId]);
      if (result.rowCount !== 1) throw new NotFoundException();
      await this.auditLogs.record(database, applicationKey, 'sensitive_word.removed', 'sensitive_word', wordId, { word: result.rows[0].word });
    });
  }

  private normalize(word: string): string { return word.trim().toLocaleLowerCase(); }
}