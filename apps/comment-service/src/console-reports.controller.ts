import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ConsolePage, AutoBanRecord, ConsoleReportsService, ReportRecord } from './console-reports.service.js';
import { LocalOperatorGuard } from './local-operator.guard.js';

class ListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

@Controller('console')
@UseGuards(LocalOperatorGuard)
export class ConsoleReportsController {
  constructor(private readonly reports: ConsoleReportsService) {}

  @Get('reports')
  listReports(@Headers('x-application-key') applicationKey: string, @Query() query: ListQueryDto): Promise<ConsolePage<ReportRecord>> {
    return this.reports.reports(applicationKey, query.page, query.pageSize);
  }

  @Get('auto-bans')
  listAutoBans(@Headers('x-application-key') applicationKey: string, @Query() query: ListQueryDto): Promise<ConsolePage<AutoBanRecord>> {
    return this.reports.autoBans(applicationKey, query.page, query.pageSize);
  }
}