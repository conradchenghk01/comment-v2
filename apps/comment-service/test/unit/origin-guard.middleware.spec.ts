import { describe, expect, it, vi } from 'vitest';
import { OriginGuardMiddleware } from '../../src/origin-guard.middleware.js';

describe('OriginGuardMiddleware', () => {
  it.each(['http://localhost:5173', 'http://localhost:5174'])('US-local-tools: allows the local tool origin %s only in local', async (origin) => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'local';
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() };
    const next = vi.fn();
    await new OriginGuardMiddleware({ isAllowed: vi.fn(), isRegistered: vi.fn() } as never).use({ method: 'POST', header: vi.fn().mockReturnValue(origin) } as never, response as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', origin);
    process.env.APP_ENV = previous;
  });

  it('US-local-tools: does not grant the local tool exception outside local', async () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'production';
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() };
    await new OriginGuardMiddleware({ isAllowed: vi.fn().mockResolvedValue(false), isRegistered: vi.fn() } as never).use({ method: 'POST', header: vi.fn().mockReturnValueOnce('http://localhost:5173').mockReturnValueOnce(undefined) } as never, response as never, vi.fn());
    expect(response.status).toHaveBeenCalledWith(403);
    process.env.APP_ENV = previous;
  });
});