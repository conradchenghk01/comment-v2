import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CacheService } from './cache.service.js';
import { DatabaseService } from './database.service.js';
import { LocalOnlyGuard } from './local-only.guard.js';

class ResetDto { @IsIn(['RESET']) confirm!: 'RESET'; }

@Controller('local/reset')
@UseGuards(LocalOnlyGuard)
export class LocalResetController {
  constructor(private readonly database: DatabaseService, private readonly cache: CacheService) {}

  @Post()
  @HttpCode(200)
  async reset(@Body() body: ResetDto): Promise<{ status: string }> {
    if (body.confirm !== 'RESET') throw new Error('unreachable');
    await this.database.transaction(async (database) => {
      await database.query(`TRUNCATE comment_idempotency_keys, sensitive_words, application_origins, audit_logs, user_offenses, user_blocks, reports, muted_users, triple_reactions, comment_reactions, comments, application_settings, applications RESTART IDENTITY CASCADE`);
    });
    await this.cache.flushAll();
    await this.database.applySchema();
    return { status: 'reset' };
  }
}
