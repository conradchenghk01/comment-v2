import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApplicationsService, ApplicationRecord } from './applications.service.js';
import { LocalOperatorGuard } from './local-operator.guard.js';

class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(3)
  @MaxLength(32)
  slug!: string;
}

class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}

@Controller('console/applications')
@UseGuards(LocalOperatorGuard)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(@Body() body: CreateApplicationDto): Promise<ApplicationRecord> {
    return this.applications.create(body.name, body.slug);
  }

  @Get()
  list(): Promise<ApplicationRecord[]> {
    return this.applications.list();
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() body: UpdateApplicationDto, @Req() request: Request & { operator: { accountId: string } }): Promise<ApplicationRecord> {
    return this.applications.update(key, body.name, body.status, request.operator.accountId);
  }
}