import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  CustomFileValidationPipe,
  getMaxSize,
} from '@gitroom/nestjs-libraries/upload/custom.upload.validation';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { GetPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/get.posts.dto';
import { ChangePostStatusDto } from '@gitroom/nestjs-libraries/dtos/posts/change.post.status.dto';
import { UpdatePostSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/update.post.settings.dto';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { VideoFunctionDto } from '@gitroom/nestjs-libraries/dtos/videos/video.function.dto';
import { UploadDto } from '@gitroom/nestjs-libraries/dtos/media/upload.dto';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { GetNotificationsDto } from '@gitroom/nestjs-libraries/dtos/notifications/get.notifications.dto';
import { Readable } from 'stream';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromBuffer } = require('file-type');

const PUBLIC_API_ALLOWED_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'video/mp4',
]);
import * as Sentry from '@sentry/nestjs';
import {
  socialIntegrationList,
  IntegrationManager,
} from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { getValidationSchemas } from '@gitroom/nestjs-libraries/chat/validation.schemas.helper';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { PostValidationException } from '@gitroom/backend/api/routes/posts.validation.exception';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import {
  UpdateDto,
  WebhooksDto,
} from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { PublicYoutubePublishDto } from '@gitroom/backend/public-api/dtos/public.youtube.dto';
import {
  YoutubeProvider,
  YoutubeThumbnailPublishError,
} from '@gitroom/nestjs-libraries/integrations/social/youtube.provider';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import {
  normalizeYoutubeMedia,
  YoutubeMediaFormatUnsupportedError,
  YoutubeMediaTranscodeError,
} from '@gitroom/backend/public-api/services/youtube.media.normalizer';

@ApiTags('Public API')
@Controller('/public/v1')
export class PublicIntegrationsController {
  private storage = UploadFactory.createStorage();

  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService,
    private _mediaService: MediaService,
    private _notificationService: NotificationService,
    private _integrationManager: IntegrationManager,
    private _refreshIntegrationService: RefreshIntegrationService,
    private _webhooksService: WebhooksService
  ) {}

  @Get('/version')
  getVersion() {
    Sentry.metrics.count('public_api-request', 1);
    return {
      product: 'HappyM.Postiz',
      apiVersion: '1',
      upstreamVersion: process.env.POSTIZ_UPSTREAM_VERSION || '2.23.0',
      forkVersion: process.env.HAPPYM_POSTIZ_VERSION || '1.0.0-alpha.8',
      capabilities: [
        'analytics',
        'chat',
        'integration-settings',
        'media',
        'notifications',
        'posts',
        'providers',
        'signed-webhooks',
        'video',
        'youtube-publish',
      ],
    };
  }

  @Get('/providers')
  getProviders() {
    Sentry.metrics.count('public_api-request', 1);
    return {
      social: socialIntegrationList.map((provider) => ({
        name: provider.name,
        identifier: provider.identifier,
        toolTip: provider.toolTip,
        editor: provider.editor,
        isExternal: !!provider.externalUrl,
        isWeb3: !!provider.isWeb3,
        isChromeExtension: !!provider.isChromeExtension,
      })),
      article: [],
    };
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new CustomFileValidationPipe())
  async uploadSimple(
    @GetOrgFromRequest() org: Organization,
    @UploadedFile('file') file: Express.Multer.File
  ) {
    Sentry.metrics.count('public_api-request', 1);
    if (!file) {
      throw new HttpException({ msg: 'No file provided' }, 400);
    }

    const getFile = await this.storage.uploadFile(file);
    return this._mediaService.saveFile(
      org.id,
      getFile.originalname,
      getFile.path
    );
  }

  @Post('/upload-from-url')
  async uploadsFromUrl(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UploadDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    let response: globalThis.Response;
    try {
      response = await fetch(body.url, {
        // @ts-ignore — undici option, not in lib.dom fetch types
        dispatcher: ssrfSafeDispatcher,
      });
    } catch {
      // Network-level failure (DNS, connection refused, SSRF block, etc.) —
      // fetch rejects rather than returning a non-ok response.
      throw new HttpException({ msg: 'Failed to fetch URL' }, 400);
    }
    if (!response.ok) {
      throw new HttpException({ msg: 'Failed to fetch URL' }, 400);
    }

    // Guard against OOM: bail out before buffering the whole body into memory.
    // Content-Length may be absent or wrong, so we re-check the real size after
    // download too. The type isn't known yet (sniffed below), so the pre-check
    // uses the largest allowed cap (video).
    const maxDownloadSize = getMaxSize('video/mp4');
    const declaredSize = Number(response.headers.get('content-length'));
    if (declaredSize && declaredSize > maxDownloadSize) {
      throw new HttpException({ msg: 'File is too large.' }, 400);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const detected = await fromBuffer(buffer);
    if (!detected || !PUBLIC_API_ALLOWED_MIME.has(detected.mime)) {
      throw new HttpException({ msg: 'Unsupported file type.' }, 400);
    }

    if (buffer.length > getMaxSize(detected.mime)) {
      throw new HttpException({ msg: 'File is too large.' }, 400);
    }

    const mimetype = detected.mime;
    const ext = detected.ext;

    const getFile = await this.storage.uploadFile({
      buffer,
      mimetype,
      size: buffer.length,
      path: '',
      fieldname: '',
      destination: '',
      stream: new Readable(),
      filename: '',
      originalname: `upload.${ext}`,
      encoding: '',
    });

    return this._mediaService.saveFile(
      org.id,
      getFile.originalname,
      getFile.path
    );
  }

  @Get('/media')
  async getMedia(
    @GetOrgFromRequest() org: Organization,
    @Query('page') page = 1,
    @Query('search') search?: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._mediaService.getMedia(org.id, page, search);
  }

  @Delete('/media/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const result = await this._mediaService.deleteMediaIfExists(org.id, id);
    if (result.count === 0) {
      throw new HttpException(
        { code: 'media_not_found', message: 'Media was not found.' },
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('/find-slot/:id')
  async findSlotIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id?: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return { date: await this._postsService.findFreeDateTime(org.id, id) };
  }

  @Get('/posts')
  async getPosts(
    @GetOrgFromRequest() org: Organization,
    @Query() query: GetPostsDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const posts = await this._postsService.getPosts(org.id, query);
    return {
      posts,
      // comments,
    };
  }

  @Post('/posts')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async createPost(
    @GetOrgFromRequest() org: Organization,
    @Body() rawBody: any
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const body = await this._postsService.mapTypeToPost(
      rawBody,
      org.id,
      rawBody?.type === 'draft' || true
    );
    body.type = rawBody.type;

    if (
      process.env.RESTRICT_UPLOAD_DOMAINS &&
      body.posts.some((p) =>
        p.value.some((a) =>
          a.image.some(
            (i) => i.path.indexOf(process.env.RESTRICT_UPLOAD_DOMAINS) === -1
          )
        )
      )
    ) {
      throw new HttpException(
        {
          msg: `All media must be uploaded through our upload API route and contain the domain: ${process.env.RESTRICT_UPLOAD_DOMAINS}`,
        },
        400
      );
    }

    // Server-side validation — same rules as the dashboard, surfaced as a
    // readable 400 (see PostValidationExceptionFilter).
    const validation = await this._postsService.validatePosts(
      org.id,
      body.posts
    );

    const fail = (item: (typeof validation)[number], error: string) => {
      throw new PostValidationException({
        provider: item.identifier,
        name: item.name,
        error,
      });
    };

    for (const item of validation) {
      if (item.emptyContent) {
        fail(
          item,
          'Your post should have at least one character or one image.'
        );
      }
    }

    if (body.type !== 'draft') {
      for (const item of validation) {
        if (!item.valid) {
          fail(item, item.settingsError || 'Please fix your settings');
        }
        if (item.errors !== true) {
          fail(item, item.errors as string);
        }
        if (item.tooLong) {
          fail(item, 'post is too long, please fix it');
        }
      }
    }

    const allowedCreationMethods = ['CLI', 'API'] as const;
    const creationMethod = allowedCreationMethods.includes(
      rawBody.creationMethod
    )
      ? (rawBody.creationMethod as 'CLI' | 'API')
      : 'API';

    return this._postsService.createPost(org.id, body, creationMethod);
  }

  @Post('/posts/youtube/publish')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async publishYoutube(
    @GetOrgFromRequest() org: Organization,
    @Body() body: PublicYoutubePublishDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const videoReference = body.videoMediaId || body.videoPath;
    if (!videoReference) {
      throw new HttpException(
        {
          code: 'media_video_required',
          message: 'A tenant-owned video media reference is required.',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (
      !body.title?.trim() ||
      !['yt-video', 'yt-shorts'].includes(body.formatHint)
    ) {
      throw new HttpException(
        {
          code: 'youtube_request_invalid',
          message: 'The YouTube publish request is invalid.',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const integration = await this._integrationService.getIntegrationById(
      org.id,
      body.accountId
    );
    if (
      !integration ||
      integration.providerIdentifier !== 'youtube' ||
      integration.disabled
    ) {
      throw new HttpException(
        {
          code: 'youtube_account_not_found',
          message: 'The YouTube account was not found.',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const video = await this._mediaService.getMediaForOrganization(
      org.id,
      videoReference
    );
    if (!video) {
      throw new HttpException(
        {
          code: 'media_video_required',
          message: 'A tenant-owned video is required.',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const thumbnailReference = body.thumbnailMediaId || body.thumbnailPath;
    const thumbnail = thumbnailReference
      ? await this._mediaService.getMediaForOrganization(
          org.id,
          thumbnailReference
        )
      : undefined;
    if (thumbnailReference && !thumbnail) {
      throw new HttpException(
        {
          code: 'thumbnail_rejected',
          message: 'The thumbnail was not found in this organization.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }
    if (
      thumbnail &&
      !/\.(jpe?g|png)$/i.test(thumbnail.path.toLowerCase().split('?')[0])
    ) {
      throw new HttpException(
        {
          code: 'thumbnail_rejected',
          message: 'The thumbnail must be JPEG or PNG.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY
      );
    }

    const provider = this._integrationManager.getSocialIntegration(
      'youtube'
    ) as YoutubeProvider;
    let accessToken = integration.token;
    let scope: 'ok' | 'upload' | 'thumbnail';
    try {
      scope = await provider.validatePublishScopes(accessToken, !!thumbnail);
    } catch {
      const refreshed = await this._refreshIntegrationService.refresh(
        integration,
        'native YouTube publish preflight'
      );
      if (!refreshed) {
        throw new HttpException(
          {
            code: 'youtube_authentication_required',
            message: 'Reconnect the YouTube account.',
          },
          HttpStatus.UNAUTHORIZED
        );
      }
      accessToken = refreshed.accessToken;
      scope = await provider
        .validatePublishScopes(accessToken, !!thumbnail)
        .catch(() => 'upload' as const);
    }

    if (scope !== 'ok') {
      throw new HttpException(
        {
          code:
            scope === 'thumbnail'
              ? 'thumbnail_scope_missing'
              : 'youtube_scope_insufficient',
          message:
            'Reconnect YouTube and grant the required publishing permissions.',
        },
        HttpStatus.FORBIDDEN
      );
    }

    const localVideoPath = `${process.env.UPLOAD_DIRECTORY || ''}${video.path}`;
    const thumbnailUrl = thumbnail
      ? `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/${(
          process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY || ''
        ).replace(/^\//, '')}${thumbnail.path}`
      : undefined;

    let normalizedVideo;
    try {
      normalizedVideo = await normalizeYoutubeMedia(localVideoPath);
    } catch (error) {
      if (error instanceof YoutubeMediaFormatUnsupportedError) {
        throw new HttpException(
          {
            code: 'media_format_unsupported',
            message: 'The video format is not supported.',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      if (error instanceof YoutubeMediaTranscodeError) {
        throw new HttpException(
          {
            code: 'media_transcode_failed',
            message: 'The video could not be converted for YouTube.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY
        );
      }
      throw error;
    }

    try {
      const [published] = await provider.post(
        makeId(20),
        accessToken,
        [
          {
            id: makeId(20),
            message: body.description || '',
            media: [{ type: 'video', path: normalizedVideo.path }],
            settings: {
              title: body.title.trim(),
              type: 'unlisted',
              selfDeclaredMadeForKids: 'no',
              tags: [],
              ...(thumbnailUrl ? { thumbnail: { path: thumbnailUrl } } : {}),
            },
          },
        ],
        integration
      );
      const videoId = published.postId;
      return {
        videoId,
        url:
          body.formatHint === 'yt-shorts'
            ? `https://www.youtube.com/shorts/${videoId}`
            : published.releaseURL,
        formatHint: body.formatHint,
        thumbnailApplied: !!thumbnail,
      };
    } catch (error) {
      if (error instanceof YoutubeThumbnailPublishError) {
        throw new HttpException(
          {
            code:
              error.reason === 'scope'
                ? 'thumbnail_scope_missing'
                : 'thumbnail_rejected',
            message:
              error.reason === 'scope'
                ? 'Reconnect YouTube and grant the thumbnail permission.'
                : 'YouTube rejected the custom thumbnail.',
            videoId: error.videoId,
            url: `https://www.youtube.com/watch?v=${error.videoId}`,
          },
          error.reason === 'scope'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.UNPROCESSABLE_ENTITY
        );
      }
      if (error instanceof RefreshToken) {
        throw new HttpException(
          {
            code: 'youtube_authentication_required',
            message: 'Reconnect the YouTube account.',
          },
          HttpStatus.UNAUTHORIZED
        );
      }
      throw new HttpException(
        {
          code: 'youtube_publish_failed',
          message: 'YouTube could not publish the video.',
        },
        HttpStatus.BAD_GATEWAY
      );
    } finally {
      await normalizedVideo.dispose();
    }
  }

  @Delete('/posts/:id')
  async deletePost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const getPostById = await this._postsService.getPost(org.id, id);
    return this._postsService.deletePost(org.id, getPostById.group);
  }

  @Delete('/posts/group/:group')
  deletePostByGroup(
    @GetOrgFromRequest() org: Organization,
    @Param('group') group: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._postsService.deletePost(org.id, group);
  }

  @Get('/is-connected')
  async getActiveIntegrations(@GetOrgFromRequest() org: Organization) {
    Sentry.metrics.count('public_api-request', 1);
    return { connected: true };
  }

  @Get('/groups')
  async listGroups(@GetOrgFromRequest() org: Organization) {
    Sentry.metrics.count('public_api-request', 1);
    return (await this._integrationService.customers(org.id)).map(
      (customer) => ({
        id: customer.id,
        name: customer.name,
      })
    );
  }

  @Get('/integrations')
  async listIntegration(
    @GetOrgFromRequest() org: Organization,
    @Query('group') group?: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return (await this._integrationService.getIntegrationsList(org.id))
      .filter((integration) => !group || integration.customer?.id === group)
      .map((integration) => ({
        id: integration.id,
        name: integration.name,
        identifier: integration.providerIdentifier,
        picture: integration.picture,
        disabled: integration.disabled,
        profile: integration.profile,
        customer: integration.customer
          ? {
              id: integration.customer.id,
              name: integration.customer.name,
            }
          : undefined,
      }));
  }

  @Get('/social/:integration')
  @CheckPolicies([AuthorizationActions.Create, Sections.CHANNEL])
  async getIntegrationUrl(
    @Param('integration') integration: string,
    @Query('refresh') refresh: string,
    @GetOrgFromRequest() org: Organization
  ) {
    Sentry.metrics.count('public_api-request', 1);
    if (
      !this._integrationManager
        .getAllowedSocialsIntegrations()
        .includes(integration)
    ) {
      throw new HttpException({ msg: 'Integration not allowed' }, 400);
    }

    const integrationProvider =
      this._integrationManager.getSocialIntegration(integration);

    if (integrationProvider.externalUrl) {
      throw new HttpException(
        {
          msg: 'This integration requires an external URL and is not supported via the public API',
        },
        400
      );
    }

    try {
      const { codeVerifier, state, url } =
        await integrationProvider.generateAuthUrl();

      if (refresh) {
        await ioRedis.set(`refresh:${state}`, refresh, 'EX', 3600);
      }

      await ioRedis.set(`organization:${state}`, org.id, 'EX', 3600);
      await ioRedis.set(`login:${state}`, codeVerifier, 'EX', 3600);

      return { url };
    } catch (err) {
      throw new HttpException({ msg: 'Failed to generate auth URL' }, 500);
    }
  }

  @Get('/notifications')
  async getNotifications(
    @GetOrgFromRequest() org: Organization,
    @Query() query: GetNotificationsDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._notificationService.getNotificationsPaginated(
      org.id,
      query.page ?? 0
    );
  }

  @Post('/generate-video')
  generateVideo(
    @GetOrgFromRequest() org: Organization,
    @Body() body: VideoDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._mediaService.generateVideo(org, body);
  }

  @Post('/video/function')
  videoFunction(@Body() body: VideoFunctionDto) {
    Sentry.metrics.count('public_api-request', 1);
    return this._mediaService.videoFunction(
      body.identifier,
      body.functionName,
      body.params
    );
  }

  @Delete('/integrations/:id')
  async deleteChannel(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const isTherePosts = await this._integrationService.getPostsForChannel(
      org.id,
      id
    );
    if (isTherePosts.length) {
      for (const post of isTherePosts) {
        this._postsService.deletePost(org.id, post.group).catch(() => {});
      }
    }

    return this._integrationService.deleteChannel(org.id, id);
  }

  @Put('/integrations/:id/settings')
  async updateIntegrationSettings(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body('additionalSettings') additionalSettings: unknown
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const integration = await this._integrationService.getIntegrationById(
      org.id,
      id
    );
    if (!integration) {
      throw new HttpException({ msg: 'Integration not found' }, 404);
    }

    let serialized: string;
    try {
      serialized =
        typeof additionalSettings === 'string'
          ? JSON.stringify(JSON.parse(additionalSettings))
          : JSON.stringify(additionalSettings);
    } catch {
      throw new HttpException({ msg: 'Invalid integration settings' }, 400);
    }

    if (!serialized || serialized.length > 64_000) {
      throw new HttpException({ msg: 'Invalid integration settings' }, 400);
    }

    await this._integrationService.updateProviderSettings(
      org.id,
      id,
      serialized
    );
    return { updated: true };
  }

  @Get('/integration-settings/:id')
  async getIntegrationSettings(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const loadIntegration = await this._integrationService.getIntegrationById(
      org.id,
      id
    );

    if (!loadIntegration) {
      throw new HttpException({ msg: 'Integration not found' }, 404);
    }

    const verified =
      JSON.parse(loadIntegration.additionalSettings || '[]')?.find(
        (p: any) => p?.title === 'Verified'
      )?.value || false;

    const integration = socialIntegrationList.find(
      (p) => p.identifier === loadIntegration.providerIdentifier
    )!;

    if (!integration) {
      return {
        output: { rules: '', maxLength: 0, settings: {}, tools: [] as any[] },
      };
    }

    const maxLength = integration.maxLength(verified);
    const schemas = !integration.dto
      ? false
      : getValidationSchemas()[integration.dto.name];
    const tools = this._integrationManager.getAllTools();
    const rules = this._integrationManager.getAllRulesDescription();

    return {
      output: {
        rules: rules[integration.identifier],
        maxLength,
        settings: !schemas ? 'No additional settings required' : schemas,
        tools: tools[integration.identifier],
      },
    };
  }

  @Get('/posts/:id/missing')
  async getMissingContent(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._postsService.getMissingContent(org.id, id);
  }

  @Put('/posts/:id/settings')
  async updatePostSettings(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdatePostSettingsDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._postsService.updatePostSettings(
      org.id,
      id,
      body.settings,
      'API'
    );
  }

  @Put('/posts/:id/status')
  async changePostStatus(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ChangePostStatusDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._postsService.changePostStatus(org.id, id, body.status);
  }

  @Put('/posts/:id/release-id')
  async updateReleaseId(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body('releaseId') releaseId: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._postsService.updateReleaseId(org.id, id, releaseId);
  }

  @Get('/posts/by-release-id/:releaseId')
  async getPostByReleaseId(
    @GetOrgFromRequest() org: Organization,
    @Param('releaseId') releaseId: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const post = await this._postsService.getPostByReleaseId(org.id, releaseId);
    if (!post) {
      throw new HttpException({ msg: 'Post not found' }, 404);
    }
    return post;
  }

  @Get('/webhooks')
  getWebhooks(@GetOrgFromRequest() org: Organization) {
    Sentry.metrics.count('public_api-request', 1);
    return this._webhooksService.getWebhooks(org.id);
  }

  @Post('/webhooks')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  createWebhook(
    @GetOrgFromRequest() org: Organization,
    @Body() body: WebhooksDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._webhooksService.createWebhook(org.id, body);
  }

  @Put('/webhooks')
  updateWebhook(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UpdateDto
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._webhooksService.createWebhook(org.id, body);
  }

  @Delete('/webhooks/:id')
  deleteWebhook(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._webhooksService.deleteWebhook(org.id, id);
  }

  @Get('/analytics/:integration')
  async getAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('date') date: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._integrationService.checkAnalytics(org, integration, date);
  }

  @Get('/analytics/post/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string,
    @Query('date') date: string
  ) {
    Sentry.metrics.count('public_api-request', 1);
    return this._postsService.checkPostAnalytics(org.id, postId, +date);
  }

  @Post('/integration-trigger/:id')
  async triggerIntegrationTool(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: { methodName: string; data: Record<string, string> }
  ) {
    Sentry.metrics.count('public_api-request', 1);
    const getIntegration = await this._integrationService.getIntegrationById(
      org.id,
      id
    );

    if (!getIntegration) {
      throw new HttpException({ msg: 'Integration not found' }, 404);
    }

    const integrationProvider = socialIntegrationList.find(
      (p) => p.identifier === getIntegration.providerIdentifier
    )!;

    if (!integrationProvider) {
      throw new HttpException({ msg: 'Integration provider not found' }, 404);
    }

    const tools = this._integrationManager.getAllTools();
    if (
      // @ts-ignore
      !tools[integrationProvider.identifier]?.some(
        (p: any) => p.methodName === body.methodName
      ) ||
      // @ts-ignore
      !integrationProvider[body.methodName]
    ) {
      throw new HttpException({ msg: 'Tool not found' }, 404);
    }

    while (true) {
      try {
        // @ts-ignore
        const result = await integrationProvider[body.methodName](
          getIntegration.token,
          body.data || {},
          getIntegration.internalId,
          getIntegration
        );

        return { output: result };
      } catch (err) {
        if (err instanceof RefreshToken) {
          const data = await this._refreshIntegrationService.refresh(
            getIntegration
          );

          if (!data) {
            await this._integrationService.disconnectChannel(
              org.id,
              getIntegration
            );
            throw new HttpException(
              { msg: 'Channel disconnected due to expired token' },
              401
            );
          }

          const { accessToken } = data;

          if (accessToken) {
            getIntegration.token = accessToken;

            if (integrationProvider.refreshWait) {
              await timer(10000);
            }

            continue;
          }
        }
        throw new HttpException({ msg: 'Unexpected error' }, 500);
      }
    }
  }
}
