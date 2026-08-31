import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class LocalOnlyGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.APP_ENV !== 'local') {
      throw new NotFoundException();
    }
    return true;
  }
}