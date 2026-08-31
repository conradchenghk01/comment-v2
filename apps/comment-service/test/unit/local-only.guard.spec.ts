import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalOnlyGuard } from '../../src/local-only.guard.js';

const originalEnvironment = process.env.APP_ENV;

afterEach(() => {
  process.env.APP_ENV = originalEnvironment;
});

describe('LocalOnlyGuard', () => {
  it('US-local-auth: permits local-only routes in local', () => {
    process.env.APP_ENV = 'local';
    expect(new LocalOnlyGuard().canActivate({} as never)).toBe(true);
  });

  it('US-local-auth: hides local-only routes outside local', () => {
    process.env.APP_ENV = 'production';
    expect(() => new LocalOnlyGuard().canActivate({} as never)).toThrow(NotFoundException);
  });
});