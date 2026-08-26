import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PrePublishRenderStatus } from '@prisma/client';

export type RenderReasonCode =
  | 'RenderRequired'
  | 'RenderLeaseHeld'
  | 'RenderTimedOut'
  | 'RenderPayloadInvalid'
  | 'PublishBlockedNoRender'
  | 'OccurrenceCancelled'
  | 'OccurrenceNotFound'
  | 'TransientEngine';

export class PrePublishRenderError extends Error {
  constructor(
    public readonly reasonCode: RenderReasonCode,
    public readonly statusCode: HttpStatus,
    message: string
  ) {
    super(message);
  }
}

export type RenderCorrelation = {
  crmSocialPostId: string;
  snapshotId: string;
  pharmacyGroupId: string;
  pharmacyId?: string | null;
};

export type RenderTarget = {
  integrationId: string;
  channel: string;
  caption: string;
  media: Array<{ mediaId: string; kind: 'image' | 'video'; mime: string }>;
  extras?: { youtubeTitle?: string; thumbnailMediaId?: string };
};

export type AttachRenderedInput = {
  renderToken: string;
  correlation: RenderCorrelation;
  targets: RenderTarget[];
  renderedAtUtc: string;
  contentHash: string;
};

const responseStatus = (status: PrePublishRenderStatus) =>
  ({
    SCHEDULED: 'Scheduled',
    AWAITING_RENDER: 'AwaitingRender',
    READY_TO_PUBLISH: 'ReadyToPublish',
    PUBLISHING: 'Publishing',
    PUBLISHED: 'Published',
    FAILED: 'Failed',
    RENDER_TIMED_OUT: 'RenderTimedOut',
    CANCELLED: 'Cancelled',
  }[status]);

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function computeRenderContentHash(input: {
  occurrenceId: string;
  correlation: RenderCorrelation;
  targets: RenderTarget[];
  renderedAtUtc: string;
}) {
  return `sha256-${createHash('sha256')
    .update(canonicalize(input), 'utf8')
    .digest('hex')}`;
}

@Injectable()
export class PrePublishRenderService {
  constructor(private readonly prisma: PrismaService) {}

  private secret() {
    const secret =
      process.env.HAPPYM_RENDER_TOKEN_SECRET ||
      process.env.HAPPYM_INTERNAL_CLIENT_SECRET;
    if (!secret || secret.length < 32) {
      throw new PrePublishRenderError(
        'TransientEngine',
        HttpStatus.SERVICE_UNAVAILABLE,
        'The render gate is not configured.'
      );
    }
    return secret;
  }

  private token(
    occurrenceId: string,
    idempotencyKey: string,
    workerId: string,
    expiresAt: Date
  ) {
    return createHmac('sha256', this.secret())
      .update(
        `${occurrenceId}\n${idempotencyKey}\n${workerId}\n${expiresAt.toISOString()}`
      )
      .digest('base64url');
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private sameToken(expectedHash: string | null, token: string) {
    if (!expectedHash || !token) return false;
    const actual = Buffer.from(this.tokenHash(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private view(occurrence: any) {
    return {
      id: occurrence.id,
      occurrenceId: occurrence.id,
      socialPostId: occurrence.postId,
      integrationId: occurrence.integrationId,
      sequence: occurrence.sequence,
      scheduledFor: occurrence.scheduledFor,
      status: responseStatus(occurrence.status),
      correlation: JSON.parse(occurrence.correlation || '{}'),
      leaseExpiresAt: occurrence.leaseExpiresAt,
      renderedAtUtc: occurrence.renderedAt,
      publishedAtUtc: occurrence.publishedAt,
      releaseId: occurrence.releaseId,
      releaseUrl: occurrence.releaseUrl,
      reasonCode: occurrence.failureReason,
    };
  }

  async ensureOccurrence(
    organizationId: string,
    postId: string,
    integrationId: string,
    sequence: number,
    scheduledFor: Date,
    leadTimeSeconds: number,
    correlation: RenderCorrelation
  ) {
    const occurrence = await this.prisma.prePublishRenderOccurrence.upsert({
      where: { postId_sequence: { postId, sequence } },
      create: {
        organizationId,
        postId,
        integrationId,
        sequence,
        scheduledFor,
        leadTimeSeconds,
        correlation: JSON.stringify(correlation),
      },
      update: {},
    });
    return this.view(occurrence);
  }

  async get(organizationId: string, occurrenceId: string) {
    const occurrence = await this.prisma.prePublishRenderOccurrence.findFirst({
      where: { id: occurrenceId, organizationId },
    });
    if (!occurrence) {
      throw new PrePublishRenderError(
        'OccurrenceNotFound',
        HttpStatus.NOT_FOUND,
        'The render occurrence was not found.'
      );
    }
    return this.view(occurrence);
  }

  async list(
    organizationId: string,
    filters: { postId?: string; status?: string; take?: number } = {}
  ) {
    const status = filters.status
      ? (Object.entries({
          Scheduled: 'SCHEDULED',
          AwaitingRender: 'AWAITING_RENDER',
          ReadyToPublish: 'READY_TO_PUBLISH',
          Publishing: 'PUBLISHING',
          Published: 'PUBLISHED',
          Failed: 'FAILED',
          RenderTimedOut: 'RENDER_TIMED_OUT',
          Cancelled: 'CANCELLED',
        }).find(([key]) => key === filters.status)?.[1] as
          | PrePublishRenderStatus
          | undefined)
      : undefined;
    const occurrences = await this.prisma.prePublishRenderOccurrence.findMany({
      where: {
        organizationId,
        ...(filters.postId ? { postId: filters.postId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
      take: Math.min(Math.max(filters.take || 50, 1), 200),
    });
    return occurrences.map((item) => this.view(item));
  }

  async markAwaiting(organizationId: string, occurrenceId: string) {
    await this.prisma.prePublishRenderOccurrence.updateMany({
      where: { id: occurrenceId, organizationId, status: 'SCHEDULED' },
      data: { status: 'AWAITING_RENDER' },
    });
    return this.get(organizationId, occurrenceId);
  }

  async claim(
    organizationId: string,
    occurrenceId: string,
    workerId: string,
    idempotencyKey: string,
    leaseSeconds = 300
  ) {
    if (!workerId?.trim() || !idempotencyKey?.trim()) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.BAD_REQUEST,
        'Worker and idempotency identifiers are required.'
      );
    }
    const now = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const occurrence = await tx.prePublishRenderOccurrence.findFirst({
          where: { id: occurrenceId, organizationId },
        });
        if (!occurrence) {
          throw new PrePublishRenderError(
            'OccurrenceNotFound',
            HttpStatus.NOT_FOUND,
            'The render occurrence was not found.'
          );
        }
        if (occurrence.status === 'CANCELLED') {
          throw new PrePublishRenderError(
            'OccurrenceCancelled',
            HttpStatus.CONFLICT,
            'The occurrence was cancelled.'
          );
        }
        if (
          occurrence.status === 'RENDER_TIMED_OUT' ||
          occurrence.scheduledFor <= now
        ) {
          throw new PrePublishRenderError(
            'RenderTimedOut',
            HttpStatus.GONE,
            'The render window has expired.'
          );
        }
        if (occurrence.status !== 'AWAITING_RENDER') {
          throw new PrePublishRenderError(
            'RenderRequired',
            HttpStatus.CONFLICT,
            'The occurrence is not awaiting a render claim.'
          );
        }

        if (
          occurrence.leaseExpiresAt &&
          occurrence.leaseExpiresAt > now &&
          occurrence.leaseIdempotencyKey === idempotencyKey &&
          occurrence.leaseWorkerId === workerId
        ) {
          return {
            ...this.view(occurrence),
            renderToken: this.token(
              occurrence.id,
              idempotencyKey,
              workerId,
              occurrence.leaseExpiresAt
            ),
          };
        }
        if (occurrence.leaseExpiresAt && occurrence.leaseExpiresAt > now) {
          throw new PrePublishRenderError(
            'RenderLeaseHeld',
            HttpStatus.CONFLICT,
            'The render lease is already held.'
          );
        }
        if (occurrence.leaseExpiresAt && occurrence.leaseExpiresAt <= now) {
          throw new PrePublishRenderError(
            'RenderTimedOut',
            HttpStatus.GONE,
            'The render lease has expired.'
          );
        }

        const requestedExpiry = new Date(
          now.getTime() + Math.min(Math.max(leaseSeconds, 60), 900) * 1000
        );
        const expiresAt =
          requestedExpiry < occurrence.scheduledFor
            ? requestedExpiry
            : occurrence.scheduledFor;
        const renderToken = this.token(
          occurrence.id,
          idempotencyKey,
          workerId,
          expiresAt
        );
        const claimed = await tx.prePublishRenderOccurrence.update({
          where: { id: occurrence.id },
          data: {
            leaseWorkerId: workerId,
            leaseIdempotencyKey: idempotencyKey,
            leaseTokenHash: this.tokenHash(renderToken),
            leaseExpiresAt: expiresAt,
          },
        });
        return { ...this.view(claimed), renderToken };
      },
      { isolationLevel: 'Serializable' }
    );
  }

  async attach(
    organizationId: string,
    occurrenceId: string,
    idempotencyKey: string,
    input: AttachRenderedInput
  ) {
    if (!idempotencyKey?.trim() || !input?.renderToken) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.BAD_REQUEST,
        'Idempotency key and render token are required.'
      );
    }
    const occurrence = await this.prisma.prePublishRenderOccurrence.findFirst({
      where: { id: occurrenceId, organizationId },
    });
    if (!occurrence) {
      throw new PrePublishRenderError(
        'OccurrenceNotFound',
        HttpStatus.NOT_FOUND,
        'The render occurrence was not found.'
      );
    }
    if (
      occurrence.attachIdempotencyKey === idempotencyKey &&
      occurrence.contentHash === input.contentHash &&
      ['READY_TO_PUBLISH', 'PUBLISHING', 'PUBLISHED'].includes(
        occurrence.status
      )
    ) {
      return this.view(occurrence);
    }
    if (occurrence.status === 'CANCELLED') {
      throw new PrePublishRenderError(
        'OccurrenceCancelled',
        HttpStatus.CONFLICT,
        'The occurrence was cancelled.'
      );
    }
    if (
      occurrence.status !== 'AWAITING_RENDER' ||
      !occurrence.leaseExpiresAt ||
      occurrence.leaseExpiresAt <= new Date()
    ) {
      throw new PrePublishRenderError(
        'RenderTimedOut',
        HttpStatus.GONE,
        'The render lease has expired.'
      );
    }
    if (!this.sameToken(occurrence.leaseTokenHash, input.renderToken)) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.FORBIDDEN,
        'The render token is invalid.'
      );
    }

    const expectedCorrelation = JSON.parse(occurrence.correlation || '{}');
    if (canonicalize(expectedCorrelation) !== canonicalize(input.correlation)) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'The render correlation does not match the occurrence.'
      );
    }
    if (
      input.targets?.length !== 1 ||
      input.targets[0].integrationId !== occurrence.integrationId ||
      !input.targets[0].caption?.trim() ||
      !input.targets[0].media?.length ||
      /\{\{\s*(?:ds_|env_)/i.test(input.targets[0].caption) ||
      input.targets[0].media.some((item) =>
        /\.hmproj(?:$|[?#])/i.test(item.mediaId)
      )
    ) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'The rendered target is incomplete or unresolved.'
      );
    }
    const renderedAt = new Date(input.renderedAtUtc);
    if (
      Number.isNaN(renderedAt.getTime()) ||
      renderedAt.getTime() > Date.now() + 5 * 60 * 1000
    ) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'The rendered timestamp is invalid.'
      );
    }
    const expectedHash = computeRenderContentHash({
      occurrenceId,
      correlation: input.correlation,
      targets: input.targets,
      renderedAtUtc: input.renderedAtUtc,
    });
    if (input.contentHash !== expectedHash) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'The rendered content hash does not match the payload.'
      );
    }

    const target = input.targets[0];
    const integration = await this.prisma.integration.findFirst({
      where: {
        id: target.integrationId,
        organizationId,
        deletedAt: null,
      },
      select: { providerIdentifier: true },
    });
    if (!integration || integration.providerIdentifier !== target.channel) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'The rendered channel does not match the scheduled integration.'
      );
    }
    const mediaIds = [
      ...target.media.map((item) => item.mediaId),
      ...(target.extras?.thumbnailMediaId
        ? [target.extras.thumbnailMediaId]
        : []),
    ];
    const media = await this.prisma.media.findMany({
      where: { id: { in: mediaIds }, organizationId, deletedAt: null },
    });
    if (new Set(media.map((item) => item.id)).size !== new Set(mediaIds).size) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'One or more rendered media items were not found.'
      );
    }
    if (media.some((item) => /\.hmproj(?:$|[?#])/i.test(item.path))) {
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Project sources cannot be attached as publishable media.'
      );
    }
    const byId = new Map(media.map((item) => [item.id, item]));

    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.prePublishRenderOccurrence.findFirst({
          where: { id: occurrenceId, organizationId },
        });
        if (
          current?.attachIdempotencyKey === idempotencyKey &&
          current.contentHash === input.contentHash
        ) {
          return this.view(current);
        }
        if (
          current?.status !== 'AWAITING_RENDER' ||
          !current.leaseExpiresAt ||
          current.leaseExpiresAt <= new Date() ||
          !this.sameToken(current.leaseTokenHash, input.renderToken)
        ) {
          throw new PrePublishRenderError(
            'RenderPayloadInvalid',
            HttpStatus.CONFLICT,
            'The occurrence no longer accepts rendered media.'
          );
        }
        const post = await tx.post.findFirst({
          where: { id: current.postId, organizationId, deletedAt: null },
        });
        if (!post) {
          throw new PrePublishRenderError(
            'OccurrenceNotFound',
            HttpStatus.NOT_FOUND,
            'The scheduled social post was not found.'
          );
        }
        let settings: Record<string, unknown> = {};
        try {
          settings = JSON.parse(post.settings || '{}');
        } catch {}
        const thumbnail = target.extras?.thumbnailMediaId
          ? byId.get(target.extras.thumbnailMediaId)
          : undefined;
        const thumbnailPath = thumbnail
          ? thumbnail.path.startsWith('http')
            ? thumbnail.path
            : `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/${(
                process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY || ''
              ).replace(/^\//, '')}${thumbnail.path}`
          : undefined;
        await tx.post.update({
          where: { id: post.id },
          data: {
            content: target.caption,
            image: JSON.stringify(
              target.media.map((item) => ({
                id: item.mediaId,
                path: byId.get(item.mediaId)!.path,
                type: item.kind,
              }))
            ),
            settings: JSON.stringify({
              ...settings,
              ...(target.extras?.youtubeTitle
                ? { title: target.extras.youtubeTitle }
                : {}),
              ...(thumbnail
                ? { thumbnail: { id: thumbnail.id, path: thumbnailPath } }
                : {}),
            }),
          },
        });
        const ready = await tx.prePublishRenderOccurrence.update({
          where: { id: current.id },
          data: {
            status: 'READY_TO_PUBLISH',
            attachIdempotencyKey: idempotencyKey,
            contentHash: input.contentHash,
            renderedPayload: JSON.stringify({
              correlation: input.correlation,
              targets: input.targets,
            }),
            renderedAt,
            leaseTokenHash: null,
          },
        });
        return this.view(ready);
      },
      { isolationLevel: 'Serializable' }
    );
  }

  async cancel(organizationId: string, occurrenceId: string) {
    const result = await this.prisma.prePublishRenderOccurrence.updateMany({
      where: {
        id: occurrenceId,
        organizationId,
        status: { in: ['SCHEDULED', 'AWAITING_RENDER', 'READY_TO_PUBLISH'] },
      },
      data: { status: 'CANCELLED', failureReason: 'OccurrenceCancelled' },
    });
    if (!result.count) {
      const current = await this.get(organizationId, occurrenceId);
      if (current.status === 'Cancelled') return current;
      throw new PrePublishRenderError(
        'RenderPayloadInvalid',
        HttpStatus.CONFLICT,
        'The occurrence can no longer be cancelled.'
      );
    }
    return this.get(organizationId, occurrenceId);
  }

  async workflowState(organizationId: string, occurrenceId: string) {
    const occurrence = await this.prisma.prePublishRenderOccurrence.findFirst({
      where: { id: occurrenceId, organizationId },
    });
    if (!occurrence) return { status: 'Missing' };
    if (
      (occurrence.status === 'AWAITING_RENDER' &&
        occurrence.leaseExpiresAt &&
        occurrence.leaseExpiresAt <= new Date()) ||
      (['SCHEDULED', 'AWAITING_RENDER'].includes(occurrence.status) &&
        occurrence.scheduledFor <= new Date())
    ) {
      await this.timeout(organizationId, occurrenceId);
      return { status: 'RenderTimedOut' };
    }
    return { status: responseStatus(occurrence.status) };
  }

  async timeout(organizationId: string, occurrenceId: string) {
    await this.prisma.prePublishRenderOccurrence.updateMany({
      where: {
        id: occurrenceId,
        organizationId,
        status: { in: ['SCHEDULED', 'AWAITING_RENDER'] },
      },
      data: { status: 'RENDER_TIMED_OUT', failureReason: 'RenderTimedOut' },
    });
  }

  async beginPublishing(organizationId: string, occurrenceId: string) {
    const result = await this.prisma.prePublishRenderOccurrence.updateMany({
      where: { id: occurrenceId, organizationId, status: 'READY_TO_PUBLISH' },
      data: { status: 'PUBLISHING' },
    });
    if (!result.count) {
      const current = await this.prisma.prePublishRenderOccurrence.findFirst({
        where: { id: occurrenceId, organizationId },
      });
      if (current && ['PUBLISHING', 'PUBLISHED'].includes(current.status)) {
        return;
      }
      throw new PrePublishRenderError(
        'PublishBlockedNoRender',
        HttpStatus.CONFLICT,
        'Publishing is blocked until rendered media is attached.'
      );
    }
  }

  async assertPublishAllowed(organizationId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
      select: { renderRequired: true },
    });
    if (!post?.renderRequired) return;
    const latest = await this.prisma.prePublishRenderOccurrence.findFirst({
      where: { postId, organizationId },
      orderBy: { sequence: 'desc' },
    });
    if (latest?.status !== 'PUBLISHING') {
      throw new PrePublishRenderError(
        'PublishBlockedNoRender',
        HttpStatus.CONFLICT,
        'Publishing is blocked until rendered media is attached.'
      );
    }
  }

  async completeFromPost(organizationId: string, occurrenceId: string) {
    const occurrence = await this.prisma.prePublishRenderOccurrence.findFirst({
      where: { id: occurrenceId, organizationId },
      include: { post: true },
    });
    if (!occurrence) return;
    const published = occurrence.post.state === 'PUBLISHED';
    await this.prisma.prePublishRenderOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status: published ? 'PUBLISHED' : 'FAILED',
        publishedAt: published ? new Date() : null,
        releaseId: occurrence.post.releaseId,
        releaseUrl: occurrence.post.releaseURL,
        failureReason: published
          ? null
          : occurrence.post.error || 'PublishFailed',
      },
    });
  }
}
