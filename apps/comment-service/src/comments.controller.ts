import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { BatchArticleComments, CommentsService, CommentPage, CommentRecord, CommentSort, HotArticle } from './comments.service.js';
import { LocalMemberGuard, MemberIdentity } from './local-member.guard.js';
import { PublicBlockGuard } from './public-block.guard.js';

class CreateCommentDto { @IsString() @MinLength(1) body!: string; }
class ListCommentsDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20; @IsOptional() @IsIn(['relevant', 'newest', 'oldest']) sort: CommentSort = 'relevant'; @IsOptional() @IsString() cursor?: string; }
class BatchCommentsDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) articleKeys!: string[]; }

@Controller()
@UseGuards(LocalMemberGuard, PublicBlockGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('articles/:articleKey/comments')
  create(@Headers('x-application-key') applicationKey: string, @Headers('idempotency-key') idempotencyKey: string | undefined, @Param('articleKey') articleKey: string, @Body() body: CreateCommentDto, @Req() request: Request & { member: MemberIdentity }): Promise<CommentRecord> {
    return this.comments.create(applicationKey, articleKey, body.body, request.member, idempotencyKey);
  }

  @Get('articles/:articleKey/comments')
  list(@Headers('x-application-key') applicationKey: string, @Param('articleKey') articleKey: string, @Query() query: ListCommentsDto, @Req() request: Request & { member: MemberIdentity }): Promise<CommentPage> {
    return this.comments.list(applicationKey, articleKey, request.member.accountId, query.sort, query.cursor, query.limit);
  }

  @Post('comments/:commentId/replies')
  reply(@Headers('x-application-key') applicationKey: string, @Headers('idempotency-key') idempotencyKey: string | undefined, @Param('commentId') commentId: string, @Body() body: CreateCommentDto, @Req() request: Request & { member: MemberIdentity }): Promise<CommentRecord> {
    return this.comments.reply(applicationKey, commentId, body.body, request.member, idempotencyKey);
  }

  @Get('comments/:commentId/branch')
  branch(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Query() query: ListCommentsDto, @Req() request: Request & { member: MemberIdentity }): Promise<CommentPage> {
    return this.comments.branch(applicationKey, commentId, request.member.accountId, query.cursor, query.limit);
  }

  @Post('comments/batch')
  batch(@Headers('x-application-key') applicationKey: string, @Body() body: BatchCommentsDto, @Req() request: Request & { member: MemberIdentity }): Promise<{ items: BatchArticleComments[] }> {
    return this.comments.batch(applicationKey, request.member.accountId, body.articleKeys);
  }

  @Get('hot-articles')
  hotArticles(@Headers('x-application-key') applicationKey: string, @Query() query: ListCommentsDto): Promise<{ items: HotArticle[] }> {
    return this.comments.hotArticles(applicationKey, query.limit);
  }
}