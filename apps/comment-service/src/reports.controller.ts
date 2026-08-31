import { Body, Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { LocalMemberGuard, MemberIdentity } from './local-member.guard.js';
import { ReportReason, ReportsService } from './reports.service.js';

class CreateReportDto { @IsIn(['spam', 'harassment', 'hate', 'misinformation', 'sexual_content', 'violence']) reasonCategory!: ReportReason; }

@Controller('comments')
@UseGuards(LocalMemberGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post(':commentId/reports')
  @HttpCode(204)
  async create(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Body() body: CreateReportDto, @Req() request: Request & { member: MemberIdentity }): Promise<void> {
    await this.reports.create(applicationKey, request.member.accountId, commentId, body.reasonCategory);
  }
}