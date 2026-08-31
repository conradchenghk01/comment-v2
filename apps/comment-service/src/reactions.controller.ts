import { Controller, Headers, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { LocalMemberGuard, MemberIdentity } from './local-member.guard.js';
import { Emoji, ReactionsService, ReactionState } from './reactions.service.js';
class EmojiParam { @IsIn(['laugh', 'cry', 'cheer']) emoji!: Emoji; }
@Controller('comments') @UseGuards(LocalMemberGuard)
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}
  @Put(':commentId/reactions/:emoji') toggle(@Headers('x-application-key') key: string, @Param() params: EmojiParam & { commentId: string }, @Req() request: Request & { member: MemberIdentity }): Promise<ReactionState> { return this.reactions.toggle(key, params.commentId, request.member.accountId, params.emoji); }
  @Post(':commentId/triple-reaction') triple(@Headers('x-application-key') key: string, @Param('commentId') id: string, @Req() request: Request & { member: MemberIdentity }): Promise<ReactionState> { return this.reactions.triple(key, id, request.member.accountId); }
}