import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { ModerationService, rejectionCodes, RejectionCode } from './moderation.service.js';
import { ConsoleCommentPage } from './console-comments.service.js';

class PendingQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

class RejectCommentDto {
  @IsIn(rejectionCodes) rejectionCode!: RejectionCode;
}

@Controller('console/moderation')
@UseGuards(LocalOperatorGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('pending')
  pending(@Headers('x-application-key') applicationKey: string, @Query() query: PendingQueryDto): Promise<ConsoleCommentPage> {
    return this.moderation.pending(applicationKey, query.page, query.pageSize);
  }

  @Post('comments/:commentId/approve')
  @HttpCode(204)
  approve(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Req() request: Request & { operator: { accountId: string } }): Promise<void> {
    return this.moderation.approve(applicationKey, commentId, request.operator.accountId);
  }

  @Post('comments/:commentId/reject')
  @HttpCode(204)
  reject(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Body() body: RejectCommentDto, @Req() request: Request & { operator: { accountId: string } }): Promise<void> {
    return this.moderation.reject(applicationKey, commentId, body.rejectionCode, request.operator.accountId);
  }
}