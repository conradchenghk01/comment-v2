import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health(): { status: string; environment: string } {
    return { status: 'ok', environment: process.env.APP_ENV ?? 'unknown' };
  }
}