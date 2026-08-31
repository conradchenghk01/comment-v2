import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ConsoleUsersService } from '../../src/console-users.service.js';

describe('ConsoleUsersService', () => {
  it('US-32: lists application members with comment, report, and block data', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ memberId: 'member', commentCount: 2, reportCount: 1, blockMode: 'normal', total: '1' }] });
    await expect(new ConsoleUsersService({ query } as never).list('application-key', 1, 20)).resolves.toMatchObject({ items: [expect.objectContaining({ memberId: 'member', blockMode: 'normal' })], total: 1 });
  });

  it('US-32: does not reveal stats for a user outside the selected application', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(new ConsoleUsersService({ query } as never).stats('application-key', 'member')).rejects.toBeInstanceOf(NotFoundException);
  });
});