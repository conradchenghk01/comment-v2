import { Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { ConsolePage } from './console-reports.service.js';
import { ConsoleUser, ConsoleUsersService } from './console-users.service.js';

class ListUsersQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

@Controller('console/users')
@UseGuards(LocalOperatorGuard)
export class ConsoleUsersController {
  constructor(private readonly users: ConsoleUsersService) {}

  @Get()
  list(@Headers('x-application-key') applicationKey: string, @Query() query: ListUsersQueryDto): Promise<ConsolePage<ConsoleUser>> {
    return this.users.list(applicationKey, query.page, query.pageSize);
  }

  @Get(':memberId/stats')
  stats(@Headers('x-application-key') applicationKey: string, @Param('memberId') memberId: string): Promise<ConsoleUser> {
    return this.users.stats(applicationKey, memberId);
  }
}