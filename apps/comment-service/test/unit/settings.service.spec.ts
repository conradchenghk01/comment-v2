import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../src/settings.service.js';

describe('SettingsService', () => {
  it('US-39/40/40a: updates only the submitted application settings', async () => {
    const settings = { commentIntervalSeconds: 120, dailyCommentLimit: 10, newUserCooldownHours: 48, yidunModerationEnabled: false, autoBanDurationOneHours: 12, autoBanDurationTwoHours: 48, autoBanDurationThreeHours: 96 };
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [settings] });
    const service = new SettingsService({ query } as never);
    await expect(service.update('application-key', { commentIntervalSeconds: 120, dailyCommentLimit: 10, newUserCooldownHours: 48, autoBanDurationOneHours: 12, autoBanDurationTwoHours: 48, autoBanDurationThreeHours: 96 })).resolves.toEqual(settings);
    expect(query.mock.calls[0]?.[1]).toEqual(['application-key', 120, 10, 48, null, null, null, null, 12, 48, 96]);
  });

  it('US-39: rejects settings access for an unknown application', async () => {
    const service = new SettingsService({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) } as never);
    await expect(service.get('unknown')).rejects.toBeInstanceOf(NotFoundException);
  });
});