import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { OriginsService } from './origins.service.js';

@Injectable()
export class OriginGuardMiddleware implements NestMiddleware {
  constructor(private readonly origins: OriginsService) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const origin = request.header('origin');
    if (!origin) return next();
    const applicationKey = request.header('x-application-key');
    const allowed = request.method === 'OPTIONS' ? await this.origins.isRegistered(origin) : applicationKey ? await this.origins.isAllowed(applicationKey, origin) : false;
    if (!allowed) { response.status(403).json({ code: 'origin_not_allowed', message: 'Origin is not allowed' }); return; }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Application-Key, Idempotency-Key');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (request.method === 'OPTIONS') { response.status(204).end(); return; }
    next();
  }
}