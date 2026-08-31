import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';

export interface MemberIdentity {
  accountId: string;
  name: string;
  avatarUrl: string;
  createdAt: string;
}

@Injectable()
export class LocalMemberGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.APP_ENV !== 'local') throw new UnauthorizedException();
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; member?: MemberIdentity }>();
    const token = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();
    try {
      const secret = new TextEncoder().encode(process.env.LOCAL_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      if (payload.role !== 'member' || typeof payload.accountId !== 'string' || typeof payload.name !== 'string' || typeof payload.avaterUrl !== 'string' || typeof payload.createdAt !== 'string') throw new UnauthorizedException();
      request.member = { accountId: payload.accountId, name: payload.name, avatarUrl: payload.avaterUrl, createdAt: payload.createdAt };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}