import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { DatabaseExecutor, DatabaseService } from './database.service.js';

export interface AuditLog { id: string; operatorId: string | null; action: string; targetType: string; targetId: string; metadata: Record<string, unknown>; createdAt: string; }
export interface AuditLogPage { items: AuditLog[]; page: number; pageSize: number; total: number; }

@Injectable()
export class AuditLogsService {
  constructor(private readonly database: DatabaseService) {}

  async record(database: DatabaseExecutor, applicationKey: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await database.query(`INSERT INTO audit_logs (id, application_id, action, target_type, target_id, metadata) SELECT $1, application.id, $3, $4, $5, $6::jsonb FROM applications application WHERE application.key = $2`, [ulid(), applicationKey, action, targetType, targetId, JSON.stringify(metadata)]);
  }

  async recordForApplicationId(database: DatabaseExecutor, applicationId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await database.query(`INSERT INTO audit_logs (id, application_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`, [ulid(), applicationId, action, targetType, targetId, JSON.stringify(metadata)]);
  }

  async list(applicationKey: string, page: number, pageSize: number): Promise<AuditLogPage> {
    const result = await this.database.query<AuditLog & { total: string }>(
      `SELECT audit.id, audit.operator_id AS "operatorId", audit.action, audit.target_type AS "targetType", audit.target_id AS "targetId", audit.metadata, audit.created_at AS "createdAt", count(*) OVER()::text AS total FROM audit_logs audit JOIN applications application ON application.id = audit.application_id WHERE application.key = $1 ORDER BY audit.created_at DESC, audit.id DESC LIMIT $2 OFFSET $3`,
      [applicationKey, pageSize, (page - 1) * pageSize]
    );
    const total = Number(result.rows[0]?.total ?? 0);
    return { items: result.rows.map(({ total: _total, ...audit }) => audit), page, pageSize, total };
  }
}