import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

export interface ApplicationSettings {
  commentIntervalSeconds: number;
  dailyCommentLimit: number;
  newUserCooldownHours: number;
  yidunModerationEnabled: boolean;
  autoBanThresholdOne: number;
  autoBanThresholdTwo: number;
  autoBanThresholdThree: number;
}

@Injectable()
export class SettingsService {
  constructor(private readonly database: DatabaseService) {}

  async get(applicationKey: string): Promise<ApplicationSettings> {
    const result = await this.database.query<ApplicationSettings>(
      `SELECT settings.comment_interval_seconds AS "commentIntervalSeconds", settings.daily_comment_limit AS "dailyCommentLimit", settings.new_user_cooldown_hours AS "newUserCooldownHours", settings.yidun_moderation_enabled AS "yidunModerationEnabled", settings.auto_ban_threshold_one AS "autoBanThresholdOne", settings.auto_ban_threshold_two AS "autoBanThresholdTwo", settings.auto_ban_threshold_three AS "autoBanThresholdThree"
       FROM application_settings settings JOIN applications application ON application.id = settings.application_id
       WHERE application.key = $1`,
      [applicationKey]
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    return result.rows[0];
  }

  async update(applicationKey: string, update: Partial<ApplicationSettings>): Promise<ApplicationSettings> {
    const result = await this.database.query<ApplicationSettings>(
      `UPDATE application_settings settings SET comment_interval_seconds = COALESCE($2, settings.comment_interval_seconds), daily_comment_limit = COALESCE($3, settings.daily_comment_limit), new_user_cooldown_hours = COALESCE($4, settings.new_user_cooldown_hours), yidun_moderation_enabled = COALESCE($5, settings.yidun_moderation_enabled), auto_ban_threshold_one = COALESCE($6, settings.auto_ban_threshold_one), auto_ban_threshold_two = COALESCE($7, settings.auto_ban_threshold_two), auto_ban_threshold_three = COALESCE($8, settings.auto_ban_threshold_three)
       FROM applications application WHERE application.id = settings.application_id AND application.key = $1
       RETURNING settings.comment_interval_seconds AS "commentIntervalSeconds", settings.daily_comment_limit AS "dailyCommentLimit", settings.new_user_cooldown_hours AS "newUserCooldownHours", settings.yidun_moderation_enabled AS "yidunModerationEnabled", settings.auto_ban_threshold_one AS "autoBanThresholdOne", settings.auto_ban_threshold_two AS "autoBanThresholdTwo", settings.auto_ban_threshold_three AS "autoBanThresholdThree"`,
      [applicationKey, update.commentIntervalSeconds ?? null, update.dailyCommentLimit ?? null, update.newUserCooldownHours ?? null, update.yidunModerationEnabled ?? null, update.autoBanThresholdOne ?? null, update.autoBanThresholdTwo ?? null, update.autoBanThresholdThree ?? null]
    );
    if (result.rowCount !== 1) throw new NotFoundException();
    return result.rows[0];
  }
}