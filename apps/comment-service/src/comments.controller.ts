import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CommentsService, CommentPage, CommentRecord, CommentSort } from './comments.service.js';
import { LocalMemberGuard, MemberIdentity } from './local-member.guard.js';

class CreateCommentDto { @IsString() @MinLength(1) body!: string; }
class ListCommentsDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20; @IsOptional() @IsIn(['relevant', 'newest', 'oldest']) sort: CommentSort = 'relevant'; @IsOptional() @IsString() cursor?: string; }

@Controller()
@UseGuards(LocalMemberGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('articles/:articleKey/comments')
  create(@Headers('x-application-key') applicationKey: string, @Param('articleKey') articleKey: string, @Body() body: CreateCommentDto, @Req() request: Request & { member: MemberIdentity }): Promise<CommentRecord> {
    return this.comments.create(applicationKey, articleKey, body.body, request.member);
  }

  @Get('articles/:articleKey/comments')
  list(@Headers('x-application-key') applicationKey: string, @Param('articleKey') articleKey: string, @Query() query: ListCommentsDto): Promise<CommentPage> {
    return this.comments.list(applicationKey, articleKey, query.sort, query.cursor, query.limit);
  }

  @Post('comments/:commentId/replies')
  reply(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Body() body: CreateCommentDto, @Req() request: Request & { member: MemberIdentity }): Promise<CommentRecord> {
    return this.comments.reply(applicationKey, commentId, body.body, request.member);
  }

  @Get('comments/:commentId/branch')
  branch(@Headers('x-application-key') applicationKey: string, @Param('commentId') commentId: string, @Query() query: ListCommentsDto): Promise<CommentPage> {
    return this.comments.branch(applicationKey, commentId, query.cursor, query.limit);
  }
}