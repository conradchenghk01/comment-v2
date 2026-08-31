import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { AuditLogPage, AuditLogsService } from './audit-logs.service.js';

class AuditLogsQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

@Controller('console/audit-logs')
@UseGuards(LocalOperatorGuard)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Headers('x-application-key') applicationKey: string, @Query() query: AuditLogsQueryDto): Promise<AuditLogPage> {
    return this.auditLogs.list(applicationKey, query.page, query.pageSize);
  }
}