import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';

@Injectable()
export class LocalOperatorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.APP_ENV !== 'local') throw new UnauthorizedException();
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; operator?: { accountId: string } }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();
    try {
      const secret = new TextEncoder().encode(process.env.LOCAL_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      if (payload.role !== 'operator') throw new UnauthorizedException();
      if (typeof payload.sub !== 'string') throw new UnauthorizedException();
      request.operator = { accountId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}