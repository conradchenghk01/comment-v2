import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ConsoleCommentFilters, ConsoleCommentPage, ConsoleCommentsService } from './console-comments.service.js';
import { LocalOperatorGuard } from './local-operator.guard.js';

class ListConsoleCommentsDto implements ConsoleCommentFilters {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() articleKey?: string;
  @IsOptional() @IsIn(['pending', 'published', 'rejected', 'deleted']) status?: 'pending' | 'published' | 'rejected' | 'deleted';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}
class BulkDeleteByArticleDto { @IsString() articleKey!: string; }
class BulkDeleteByUserDto { @IsString() memberId!: string; }

@Controller('console/comments')
@UseGuards(LocalOperatorGuard)
export class ConsoleCommentsController {
  constructor(private readonly comments: ConsoleCommentsService) {}

  @Get()
  list(@Headers('x-application-key') applicationKey: string, @Query() query: ListConsoleCommentsDto): Promise<ConsoleCommentPage> {
    return this.comments.list(applicationKey, query);
  }

  @Delete(':commentId')
  @HttpCode(204)
  async delete(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Req() request: Request & { operator: { accountId: string } }): Promise<void> {
    await this.comments.delete(applicationKey, commentId, request.operator.accountId);
  }

  @Post('bulk-delete-by-article')
  bulkDeleteByArticle(@Headers('x-application-key') applicationKey: string, @Body() body: BulkDeleteByArticleDto, @Req() request: Request & { operator: { accountId: string } }): Promise<{ deletedCount: number }> {
    return this.comments.bulkDeleteByArticle(applicationKey, body.articleKey, request.operator.accountId);
  }

  @Post('bulk-delete-by-user')
  bulkDeleteByUser(@Headers('x-application-key') applicationKey: string, @Body() body: BulkDeleteByUserDto, @Req() request: Request & { operator: { accountId: string } }): Promise<{ deletedCount: number }> {
    return this.comments.bulkDeleteByUser(applicationKey, body.memberId, request.operator.accountId);
  }
}