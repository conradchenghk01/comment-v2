import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MutesService } from '../../src/mutes.service.js';

describe('MutesService', () => {
  it('US-22: rejects a member muting themselves', async () => {
    const service = new MutesService({ query: vi.fn() } as never);
    await expect(service.mute('app', 'member', 'member')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('US-23: rejects unmuting a user who is not muted in this application', async () => {
    const service = new MutesService({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) } as never);
    await expect(service.unmute('app', 'member', 'other')).rejects.toBeInstanceOf(NotFoundException);
  });
});