import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { LocalAuthController } from './local-auth.controller.js';
import { LocalOnlyGuard } from './local-only.guard.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { DatabaseService } from './database.service.js';
import { LocalOperatorGuard } from './local-operator.guard.js';
import { LocalMemberGuard } from './local-member.guard.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';
import { ReactionsController } from './reactions.controller.js';
import { ReactionsService } from './reactions.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';
import { ConsoleCommentsController } from './console-comments.controller.js';
import { ConsoleCommentsService } from './console-comments.service.js';

@Module({
  controllers: [HealthController, LocalAuthController, ApplicationsController, CommentsController, ReactionsController, SettingsController, ConsoleCommentsController],
  providers: [DatabaseService, LocalOnlyGuard, LocalOperatorGuard, LocalMemberGuard, ApplicationsService, CommentsService, ReactionsService, SettingsService, ConsoleCommentsService]
})
export class AppModule {}