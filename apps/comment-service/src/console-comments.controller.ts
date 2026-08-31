import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
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
  async delete(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string): Promise<void> {
    await this.comments.delete(applicationKey, commentId);
  }

  @Post('bulk-delete-by-article')
  bulkDeleteByArticle(@Headers('x-application-key') applicationKey: string, @Body() body: BulkDeleteByArticleDto): Promise<{ deletedCount: number }> {
    return this.comments.bulkDeleteByArticle(applicationKey, body.articleKey);
  }

  @Post('bulk-delete-by-user')
  bulkDeleteByUser(@Headers('x-application-key') applicationKey: string, @Body() body: BulkDeleteByUserDto): Promise<{ deletedCount: number }> {
    return this.comments.bulkDeleteByUser(applicationKey, body.memberId);
  }
}