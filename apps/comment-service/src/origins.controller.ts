import { Body, Controller, Delete, Get, Headers, HttpCode, Put, UseGuards } from '@nestjs/common';
import { IsUrl } from 'class-validator';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { OriginsService } from './origins.service.js';

class OriginDto { @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'], require_host: true }) origin!: string; }

@Controller('console/origins')
@UseGuards(LocalOperatorGuard)
export class OriginsController {
  constructor(private readonly origins: OriginsService) {}

  @Get()
  list(@Headers('x-application-key') applicationKey: string): Promise<string[]> { return this.origins.list(applicationKey); }

  @Put()
  @HttpCode(204)
  add(@Headers('x-application-key') applicationKey: string, @Body() body: OriginDto): Promise<void> { return this.origins.add(applicationKey, body.origin); }

  @Delete()
  @HttpCode(204)
  remove(@Headers('x-application-key') applicationKey: string, @Body() body: OriginDto): Promise<void> { return this.origins.remove(applicationKey, body.origin); }
}