import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BlocksService } from './blocks.service.js';
import { MemberIdentity } from './local-member.guard.js';

@Injectable()
export class PublicBlockGuard implements CanActivate {
  constructor(private readonly blocks: BlocksService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ method: string; headers: { 'x-application-key'?: string }; member: MemberIdentity }>();
    const mode = await this.blocks.active(request.headers['x-application-key'] ?? '', request.member.accountId);
    if (mode === 'full') throw new NotFoundException();
    if (mode === 'normal' && request.method !== 'GET') throw new ForbiddenException({ code: 'normal_blocked', message: 'Your account is restricted from commenting' });
    return true;
  }
}