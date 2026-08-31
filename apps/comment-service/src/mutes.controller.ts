import { Controller, Delete, Headers, HttpCode, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { LocalMemberGuard, MemberIdentity } from './local-member.guard.js';
import { MutesService } from './mutes.service.js';

@Controller('users')
@UseGuards(LocalMemberGuard)
export class MutesController {
  constructor(private readonly mutes: MutesService) {}

  @Put(':memberId/mute')
  @HttpCode(204)
  async mute(@Headers('x-application-key') applicationKey: string, @Param('memberId') mutedMemberId: string, @Req() request: Request & { member: MemberIdentity }): Promise<void> {
    await this.mutes.mute(applicationKey, request.member.accountId, mutedMemberId);
  }

  @Delete(':memberId/mute')
  @HttpCode(204)
  async unmute(@Headers('x-application-key') applicationKey: string, @Param('memberId') mutedMemberId: string, @Req() request: Request & { member: MemberIdentity }): Promise<void> {
    await this.mutes.unmute(applicationKey, request.member.accountId, mutedMemberId);
  }
}