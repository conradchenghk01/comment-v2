import { Body, Controller, Get, Headers, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { ApplicationSettings, SettingsService } from './settings.service.js';

class UpdateSettingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(86_400) commentIntervalSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) dailyCommentLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(8_760) newUserCooldownHours?: number;
  @IsOptional() @IsBoolean() yidunModerationEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) autoBanThresholdOne?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) autoBanThresholdTwo?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) autoBanThresholdThree?: number;
}

@Controller('console/settings')
@UseGuards(LocalOperatorGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@Headers('x-application-key') applicationKey: string): Promise<ApplicationSettings> {
    return this.settings.get(applicationKey);
  }

  @Put()
  update(@Headers('x-application-key') applicationKey: string, @Body() body: UpdateSettingsDto): Promise<ApplicationSettings> {
    return this.settings.update(applicationKey, body);
  }
}