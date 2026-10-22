import { BadRequestException, Body, Controller, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ScheduleIntentError, ScheduleIntentService } from '@gitroom/nestjs-libraries/database/prisma/schedule-intents/schedule-intent.service';
import { PublicScheduleIntentRequestDto } from '@gitroom/backend/public-api/dtos/public.schedule-intent.dto';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { normalizePublicPostCommentSettings, PostCommentSettingsInvalidError } from '@gitroom/backend/public-api/services/post.comment.settings';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';
import { AuthorizationActions, Sections, SubscriptionException } from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { stripLinks } from '@gitroom/helpers/utils/strip.links';

@Controller('/public/v1/prepublish-render/schedule-intents')
export class PublicScheduleIntentController {
  constructor(private readonly intents: ScheduleIntentService, private readonly posts: PostsService,
    private readonly permissions: PermissionsService, private readonly integrations: IntegrationManager) {}

  private async guarded<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (error instanceof ScheduleIntentError)
        throw new HttpException({ code: error.code }, error.status);
      if (error instanceof SubscriptionException) throw error;
      if (error instanceof BadRequestException || error instanceof PostCommentSettingsInvalidError)
        throw new HttpException({ code: 'schedule_intent_invalid' }, HttpStatus.BAD_REQUEST);
      // A timeout/conflict may have committed; do not echo input or claim no effect.
      throw new HttpException({ code: 'schedule_intent_transient' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Get('/:intentId')
  get(@GetOrgFromRequest() org: Organization, @Param('intentId') intentId: string) {
    return this.guarded(() => this.intents.get(org.id, intentId));
  }

  @Post('/:intentId')
  create(@GetOrgFromRequest() org: Organization, @Param('intentId') intentId: string,
    @Body() request: PublicScheduleIntentRequestDto) {
    return this.guarded(async () => {
      // Replay stays readable even after a quota/configuration change.
      const prior = await this.intents.replay(org.id, intentId, request);
      if (prior) return prior;
      const envelope = this.intents.parse(intentId, request);
      const normalized = await this.posts.mapTypeToPost(normalizePublicPostCommentSettings(envelope.post), org.id);
      normalized.type = 'schedule';
      const validation = await this.posts.validatePosts(org.id, normalized.posts);
      if (validation.length !== 1 || validation.some(x => !x.valid))
        throw new ScheduleIntentError('schedule_intent_invalid', HttpStatus.BAD_REQUEST);
      const target = normalized.posts[0];
      const providerType = (target.settings as { __type?: string })?.__type;
      if (!providerType) throw new ScheduleIntentError('schedule_intent_invalid', HttpStatus.BAD_REQUEST);
      const provider = this.integrations.getSocialIntegration(providerType);
      if (provider?.stripLinks?.())
        target.value = target.value.map(value => ({ ...value, content: stripLinks(value.content) }));
      const scoped = org as Organization & { users?: Array<{ role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
        users?: { role?: 'USER' | 'ADMIN' | 'SUPERADMIN' } }> };
      const role = scoped.users?.[0]?.role ?? scoped.users?.[0]?.users?.role;
      if (!role) throw new ScheduleIntentError('forbidden', HttpStatus.FORBIDDEN);
      const ability = await this.permissions.check(org.id, org.createdAt, role,
        [[AuthorizationActions.Create, Sections.POSTS_PER_MONTH]]);
      if (!ability.can(AuthorizationActions.Create, Sections.POSTS_PER_MONTH))
        throw new SubscriptionException({ section: Sections.POSTS_PER_MONTH, action: AuthorizationActions.Create });
      return this.intents.create(org.id, intentId, request, normalized);
    });
  }

  @Post('/:intentId/cancel')
  cancel(@GetOrgFromRequest() org: Organization, @Param('intentId') intentId: string,
    @Body() request: PublicScheduleIntentRequestDto) {
    return this.guarded(() => this.intents.cancel(org.id, intentId, request));
  }
}
