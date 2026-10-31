import { createHash } from 'node:crypto';
import { ScheduleIntentService, scheduleIntentContract } from '@gitroom/nestjs-libraries/database/prisma/schedule-intents/schedule-intent.service';
import { postWorkflowV107 } from '@gitroom/orchestrator/workflows/post-workflows/post.workflow.v1.0.7';
import { executeChild, sleep } from '@temporalio/workflow';

// Temporal command boundaries are doubles; real services below are not mocked.
// This is not a Temporal replay, SQL isolation, provider or native UAT qualification.
const mockWorkflowActivities: Record<string, (...args: any[]) => Promise<any>> = {};
jest.mock('@temporalio/workflow', () => ({
  ActivityFailure: class extends Error {}, ApplicationFailure: class extends Error {},
  continueAsNew: jest.fn(), executeChild: jest.fn(), sleep: jest.fn(),
  proxyActivities: () => new Proxy({}, { get: (_target, key) => (...args: any[]) => {
    const activity = mockWorkflowActivities[String(key)];
    if (!activity) throw new Error(`Unexpected workflow activity: ${String(key)}`);
    return activity(...args);
  } }),
}));
jest.mock('@gitroom/orchestrator/workflows/post-workflows/post.workflow.v1.0.6', () => ({ postWorkflowV106: jest.fn() }));
// Validation receives its explicit collaborator in these unit cases; avoid loading unrelated provider/PDF modules.
jest.mock('@gitroom/nestjs-libraries/integrations/integration.manager', () => ({ IntegrationManager: class {} }));

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicAttachRenderedDto } from './dtos/public.prepublish-render.dto';
import { PostPayloadValidationService } from '@gitroom/nestjs-libraries/database/prisma/posts/post-payload-validation.service';
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import {
  computeRenderContentHash,
  PrePublishRenderError,
  PrePublishRenderService,
  RenderCorrelation,
  RenderTarget,
} from '@gitroom/nestjs-libraries/database/prisma/prepublish-render/prepublish-render.service';

class MemoryPrisma {
  occurrences: any[] = [];
  posts: any[] = [];
  mediaRows: any[] = [];
  intentRows: any[] = [];
  editorialScheduleIntent: any;
  providerIdentifier = 'youtube';

  prePublishRenderOccurrence: any;
  post: any;
  media: any;
  integration: any;

  constructor() {
    this.prePublishRenderOccurrence = {
      upsert: async ({ where, create }: any) => {
        const found = this.occurrences.find(
          (item) =>
            item.postId === where.postId_sequence.postId &&
            item.sequence === where.postId_sequence.sequence
        );
        if (found) return found;
        const row = {
          id: `occ-${this.occurrences.length + 1}`,
          status: 'SCHEDULED',
          leaseExpiresAt: null,
          leaseIdempotencyKey: null,
          leaseWorkerId: null,
          leaseTokenHash: null,
          attachIdempotencyKey: null,
          contentHash: null,
          renderedAt: null,
          publishedAt: null,
          releaseId: null,
          releaseUrl: null,
          failureReason: null,
          createdAt: new Date(),
          ...create,
        };
        this.occurrences.push(row);
        return row;
      },
      findFirst: async ({ where, include, orderBy }: any) => {
        let rows = this.occurrences.filter((item) => this.matches(item, where));
        if (orderBy?.sequence === 'desc') {
          rows = rows.sort((a, b) => b.sequence - a.sequence);
        }
        const row = rows[0];
        if (row && include?.post) {
          return {
            ...row,
            post: this.posts.find((post) => post.id === row.postId),
          };
        }
        return row ?? null;
      },
      findMany: async ({ where, orderBy, take }: any) =>
        this.occurrences
          .filter((item) => this.matches(item, where))
          .slice(0, take),
      update: async ({ where, data }: any) => {
        const row = this.occurrences.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = this.occurrences.filter((item) =>
          this.matches(item, where)
        );
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    };
    this.prePublishRenderOccurrence.create = async ({ data }: any) =>
      this.prePublishRenderOccurrence.upsert({ where: { postId_sequence: {
        postId: data.postId, sequence: data.sequence } }, create: data });
    this.editorialScheduleIntent = {
      findUnique: async ({ where }: any) => this.intentRows.find((row) =>
        where.postId !== undefined ? row.postId === where.postId :
          row.organizationId === where.organizationId_intentId.organizationId &&
          row.intentId === where.organizationId_intentId.intentId) ?? null,
      create: async ({ data }: any) => {
        const row = { createdAt: new Date(), ...data };
        this.intentRows.push(row); return row;
      },
    };
    this.post = {
      create: async ({ data }: any) => {
        const row = { deletedAt: null, ...data }; this.posts.push(row); return row;
      },
      findFirst: async ({ where, select }: any) => {
        const row = this.posts.find((item) => this.matches(item, where));
        if (!row) return null;
        return select
          ? Object.fromEntries(
              Object.keys(select).map((key) => [key, row[key]])
            )
          : row;
      },
      update: async ({ where, data }: any) => {
        const row = this.posts.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    };
    this.media = {
      findMany: async ({ where }: any) =>
        this.mediaRows.filter(
          (item) =>
            where.id.in.includes(item.id) &&
            item.organizationId === where.organizationId &&
            item.deletedAt === null
        ),
    };
    this.integration = {
      findFirst: async ({ where }: any) =>
        where.id === 'integration-1' && where.organizationId === 'org-a'
          ? { id: 'integration-1', name: 'Synthetic', additionalSettings: '[]', providerIdentifier: this.providerIdentifier }
          : null,
    };
  }

  $queryRaw = async () => [{ now: new Date() }];

  $transaction = async (action: (tx: this) => Promise<any>) => action(this);

  private matches(item: any, where: any): boolean {
    return Object.entries(where || {}).every(([key, expected]: any) => {
      if (expected === undefined) return true;
      if (key === 'deletedAt') return item[key] === expected;
      if (expected && typeof expected === 'object' && 'in' in expected) {
        return expected.in.includes(item[key]);
      }
      return item[key] === expected;
    });
  }
}

describe('PrePublishRenderService durable gate', () => {
  const now = new Date('2026-08-26T08:00:00.000Z');
  const correlation: RenderCorrelation = {
    crmSocialPostId: 'crm-post-1',
    snapshotId: 'snapshot-1',
    pharmacyGroupId: 'group-1',
    pharmacyId: 'pharmacy-1',
  };
  let db: MemoryPrisma;
  let service: PrePublishRenderService;
  let validation: { validate: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    process.env.HAPPYM_RENDER_TOKEN_SECRET =
      'test-secret-that-is-longer-than-32-bytes';
    db = new MemoryPrisma();
    db.posts.push({
      id: 'post-1',
      organizationId: 'org-a',
      integrationId: 'integration-1',
      deletedAt: null,
      renderRequired: true,
      settings: '{}',
      state: 'QUEUE',
      releaseId: null,
      releaseURL: null,
      error: null,
    });
    db.mediaRows.push({
      id: 'media-1',
      organizationId: 'org-a',
      path: 'rendered/video.mp4',
      deletedAt: null,
    });
    validation = { validate: jest.fn().mockResolvedValue({ valid: true, errors: true, emptyContent: false, tooLong: false }) };
    service = new PrePublishRenderService(db as any, validation as any);
  });

  afterEach(() => jest.useRealTimers());

  async function awaiting(sequence = 0) {
    const occurrence = await service.ensureOccurrence(
      'org-a',
      'post-1',
      'integration-1',
      sequence,
      new Date(now.getTime() + 10 * 60_000),
      600,
      correlation
    );
    await service.markAwaiting('org-a', occurrence.occurrenceId);
    return occurrence;
  }

  it('replays a claim idempotently and rejects a concurrent worker', async () => {
    const occurrence = await awaiting();
    const first = await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'crm-a',
      'claim-1',
      60
    );
    const replay = await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'crm-a',
      'claim-1',
      60
    );

    expect(replay.renderToken).toBe(first.renderToken);
    await expect(
      service.claim('org-a', occurrence.occurrenceId, 'crm-b', 'claim-2', 60)
    ).rejects.toMatchObject({ reasonCode: 'RenderLeaseHeld' });
  });

  it('times out after a killed CRM lease and survives service restart without publish', async () => {
    const occurrence = await awaiting();
    await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'dead-crm',
      'claim-dead',
      60
    );
    jest.setSystemTime(new Date(now.getTime() + 61_000));

    const restarted = new PrePublishRenderService(db as any, validation as any);
    await expect(
      restarted.workflowState('org-a', occurrence.occurrenceId)
    ).resolves.toEqual({ status: 'RenderTimedOut' });
    await expect(
      restarted.claim(
        'org-a',
        occurrence.occurrenceId,
        'crm-live',
        'claim-live',
        60
      )
    ).rejects.toMatchObject({ reasonCode: 'RenderTimedOut' });
    await expect(
      restarted.assertPublishAllowed('org-a', 'post-1')
    ).rejects.toMatchObject({ reasonCode: 'PublishBlockedNoRender' });
  });

  it('attaches once, replays idempotently, and opens the publish gate', async () => {
    const occurrence = await awaiting();
    const claim = await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'crm-a',
      'claim-1',
      300
    );
    const targets: RenderTarget[] = [
      {
        integrationId: 'integration-1',
        contentMode: 'media',
        channel: 'youtube',
        caption: 'Rendered caption',
        media: [{ mediaId: 'media-1', kind: 'video', mime: 'video/mp4' }],
      },
    ];
    const renderedAtUtc = now.toISOString();
    const payload = {
      renderToken: claim.renderToken,
      correlation,
      targets,
      renderedAtUtc,
      contentHash: computeRenderContentHash({
        occurrenceId: occurrence.occurrenceId,
        correlation,
        targets,
        renderedAtUtc,
      }),
    };

    const ready = await service.attach(
      'org-a',
      occurrence.occurrenceId,
      'attach-1',
      payload
    );
    const replay = await service.attach(
      'org-a',
      occurrence.occurrenceId,
      'attach-1',
      payload
    );
    expect(ready.status).toBe('ReadyToPublish');
    expect(replay.status).toBe('ReadyToPublish');
    await expect(
      service.assertPublishAllowed('org-a', 'post-1')
    ).rejects.toMatchObject({
      reasonCode: 'PublishBlockedNoRender',
    });
    await service.beginPublishing('org-a', occurrence.occurrenceId);
    await service.beginPublishing('org-a', occurrence.occurrenceId);
    await expect(
      service.assertPublishAllowed('org-a', 'post-1')
    ).resolves.toBeUndefined();
  });

  it('isolates tenants and creates distinct recurrence occurrences', async () => {
    const occurrences = await Promise.all([
      awaiting(0),
      awaiting(1),
      awaiting(2),
    ]);
    expect(new Set(occurrences.map((item) => item.occurrenceId)).size).toBe(3);
    await expect(
      service.get('org-b', occurrences[0].occurrenceId)
    ).rejects.toBeInstanceOf(PrePublishRenderError);
    await expect(service.list('org-b')).resolves.toEqual([]);
  });

  it('attaches an ordered Story sequence and exposes every child receipt', async () => {
    db.providerIdentifier = 'instagram';
    db.posts[0].settings = JSON.stringify({
      __type: 'instagram',
      post_type: 'story',
    });
    db.mediaRows.push(
      {
        id: 'media-2',
        organizationId: 'org-a',
        path: 'rendered/slide-1.png',
        deletedAt: null,
      },
      {
        id: 'media-3',
        organizationId: 'org-a',
        path: 'rendered/slide-2.mp4',
        deletedAt: null,
      }
    );
    db.mediaRows[0].path = 'rendered/slide-0.png';

    const occurrence = await awaiting();
    const claim = await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'crm-story',
      'claim-story',
      300
    );
    const targets: RenderTarget[] = [
      {
        integrationId: 'integration-1',
        contentMode: 'media',
        channel: 'instagram',
        caption: '',
        publishMode: 'story_sequence',
        media: [
          { mediaId: 'media-1', kind: 'image', mime: 'image/png' },
          { mediaId: 'media-2', kind: 'image', mime: 'image/png' },
          { mediaId: 'media-3', kind: 'video', mime: 'video/mp4' },
        ],
      },
    ];
    const renderedAtUtc = now.toISOString();
    await service.attach('org-a', occurrence.occurrenceId, 'attach-story', {
      renderToken: claim.renderToken,
      correlation,
      targets,
      renderedAtUtc,
      contentHash: computeRenderContentHash({
        occurrenceId: occurrence.occurrenceId,
        correlation,
        targets,
        renderedAtUtc,
      }),
    });

    await service.beginPublishing('org-a', occurrence.occurrenceId);
    db.posts[0].state = 'PUBLISHED';
    db.posts[0].releaseId = 'ig-story-3';
    db.posts[0].releaseURL = 'https://instagram.test/story/3';
    await service.completeFromPost('org-a', occurrence.occurrenceId, [
      {
        slideIndex: 0,
        providerId: 'ig-story-1',
        releaseUrl: 'https://instagram.test/story/1',
      },
      {
        slideIndex: 1,
        providerId: 'ig-story-2',
        releaseUrl: 'https://instagram.test/story/2',
      },
      {
        slideIndex: 2,
        providerId: 'ig-story-3',
        releaseUrl: 'https://instagram.test/story/3',
      },
    ]);

    const completed = await service.get('org-a', occurrence.occurrenceId);
    expect(completed.publishReceipt).toMatchObject({
      bundleId: `story-sequence:${occurrence.occurrenceId}`,
      mode: 'story_sequence',
      provider: 'instagram',
      status: 'Published',
    });
    expect(completed.publishReceipt.children).toEqual([
      expect.objectContaining({ slideIndex: 0, mediaId: 'media-1' }),
      expect.objectContaining({ slideIndex: 1, mediaId: 'media-2' }),
      expect.objectContaining({ slideIndex: 2, mediaId: 'media-3' }),
    ]);
  });

  it('rejects Story sequences for unsupported providers', async () => {
    const occurrence = await awaiting();
    const claim = await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'crm-story',
      'claim-story',
      300
    );
    const targets: RenderTarget[] = [
      {
        integrationId: 'integration-1',
        contentMode: 'media',
        channel: 'youtube',
        caption: 'Unsupported Story sequence',
        publishMode: 'story_sequence',
        media: [
          { mediaId: 'media-1', kind: 'video', mime: 'video/mp4' },
          { mediaId: 'media-1', kind: 'video', mime: 'video/mp4' },
        ],
      },
    ];
    const renderedAtUtc = now.toISOString();

    await expect(
      service.attach('org-a', occurrence.occurrenceId, 'attach-story', {
        renderToken: claim.renderToken,
        correlation,
        targets,
        renderedAtUtc,
        contentHash: computeRenderContentHash({
          occurrenceId: occurrence.occurrenceId,
          correlation,
          targets,
          renderedAtUtc,
        }),
      })
    ).rejects.toMatchObject({ reasonCode: 'StorySequenceUnsupported' });
  });

  it('keeps a single-media Story attach backward compatible', async () => {
    db.providerIdentifier = 'instagram';
    db.posts[0].settings = JSON.stringify({
      __type: 'instagram',
      post_type: 'story',
    });
    db.mediaRows[0].path = 'rendered/slide-0.png';
    const occurrence = await awaiting();
    const claim = await service.claim(
      'org-a',
      occurrence.occurrenceId,
      'crm-story',
      'claim-single-story',
      300
    );
    const targets: RenderTarget[] = [
      {
        integrationId: 'integration-1',
        contentMode: 'media',
        channel: 'instagram',
        caption: 'Legacy single Story',
        media: [{ mediaId: 'media-1', kind: 'image', mime: 'image/png' }],
      },
    ];
    const renderedAtUtc = now.toISOString();

    const ready = await service.attach(
      'org-a',
      occurrence.occurrenceId,
      'attach-single-story',
      {
        renderToken: claim.renderToken,
        correlation,
        targets,
        renderedAtUtc,
        contentHash: computeRenderContentHash({
          occurrenceId: occurrence.occurrenceId,
          correlation,
          targets,
          renderedAtUtc,
        }),
      }
    );

    expect(ready.status).toBe('ReadyToPublish');
    expect(JSON.parse(db.posts[0].settings).story_sequence).toBeUndefined();
  });

  it('persists three distinct recurrence attachments and receipts', async () => {
    const receiptIds: string[] = [];
    for (let sequence = 0; sequence < 3; sequence++) {
      const occurrence = await awaiting(sequence);
      const claim = await service.claim(
        'org-a',
        occurrence.occurrenceId,
        `crm-${sequence}`,
        `claim-${sequence}`,
        300
      );
      const targets: RenderTarget[] = [
        {
          integrationId: 'integration-1',
          contentMode: 'media',
          channel: 'youtube',
          caption: `Occurrence ${sequence}`,
          media: [{ mediaId: 'media-1', kind: 'video', mime: 'video/mp4' }],
        },
      ];
      const renderedAtUtc = now.toISOString();
      await service.attach(
        'org-a',
        occurrence.occurrenceId,
        `attach-${sequence}`,
        {
          renderToken: claim.renderToken,
          correlation,
          targets,
          renderedAtUtc,
          contentHash: computeRenderContentHash({
            occurrenceId: occurrence.occurrenceId,
            correlation,
            targets,
            renderedAtUtc,
          }),
        }
      );
      await service.beginPublishing('org-a', occurrence.occurrenceId);
      db.posts[0].state = 'PUBLISHED';
      db.posts[0].releaseId = `receipt-${sequence}`;
      db.posts[0].releaseURL = `https://social.test/${sequence}`;
      await service.completeFromPost('org-a', occurrence.occurrenceId);
      const completed = await service.get('org-a', occurrence.occurrenceId);
      expect(completed.status).toBe('Published');
      receiptIds.push(completed.releaseId);
      db.posts[0].state = 'QUEUE';
    }

    expect(receiptIds).toEqual(['receipt-0', 'receipt-1', 'receipt-2']);
  });

  it('times out at occurrence deadline without publishing', async () => {
    const occurrence = await awaiting();
    jest.setSystemTime(new Date(now.getTime() + 10 * 60_000));
    await expect(
      service.workflowState('org-a', occurrence.occurrenceId)
    ).resolves.toEqual({
      status: 'RenderTimedOut',
    });
    await expect(
      service.assertPublishAllowed('org-a', 'post-1')
    ).rejects.toMatchObject({
      reasonCode: 'PublishBlockedNoRender',
    });
  });

  async function textAttachment(change: (target: any) => void = () => {}) {
    db.providerIdentifier = 'facebook';
    const occurrence = await awaiting();
    const claim = await service.claim('org-a', occurrence.occurrenceId, 'text-worker', 'text-claim', 300);
    const target: RenderTarget = { integrationId: 'integration-1', channel: 'facebook',
      contentMode: 'text_only', caption: 'Caffè pronto <ok>', media: [] };
    change(target);
    const input = { renderToken: claim.renderToken, correlation, targets: [target],
      renderedAtUtc: now.toISOString(), contentHash: '' };
    input.contentHash = computeRenderContentHash({ occurrenceId: occurrence.occurrenceId, correlation: input.correlation, targets: input.targets, renderedAtUtc: input.renderedAtUtc });
    return { occurrence, input };
  }

  it('v3 text-only feed validates the native provider before Ready, stores no media, and replays attach', async () => {
    const facebook = new FacebookProvider();
    const providerCheck = jest.spyOn(facebook, 'checkValidity');
    service = new PrePublishRenderService(db as any,
      new PostPayloadValidationService({ getSocialIntegration: () => facebook } as any));
    const { occurrence, input } = await textAttachment();
    const ready = await service.attach('org-a', occurrence.occurrenceId, 'text-attach', input);
    expect(providerCheck).toHaveBeenCalledWith([[]], {}, []);
    expect(ready.status).toBe('ReadyToPublish');
    expect(db.posts[0].content).toBe('Caffè pronto <ok>');
    expect(JSON.parse(db.posts[0].image)).toEqual([]);
    const replay = await service.attach('org-a', occurrence.occurrenceId, 'text-attach', input);
    expect(replay.status).toBe('ReadyToPublish');
    expect(providerCheck).toHaveBeenCalledTimes(1);
    await expect(service.attach('org-a', occurrence.occurrenceId, 'text-attach', {
      ...input, targets: [{ ...input.targets[0], caption: 'altered while keeping the old hash' }],
    })).rejects.toMatchObject({ reasonCode: 'RenderPayloadInvalid' });
  });

  it.each(['missing-mode', 'unknown-mode', 'whitespace', 'media', 'thumbnail', 'story', 'null-media', 'hash'])(
    'v3 text-only rejects %s without opening Ready', async (changed) => {
      const { occurrence, input } = await textAttachment((target) => {
        if (changed === 'missing-mode') delete target.contentMode;
        if (changed === 'unknown-mode') target.contentMode = 'legacy';
        if (changed === 'whitespace') target.caption = '  ';
        if (changed === 'media') target.media = [{ mediaId: 'media-1', kind: 'video', mime: 'video/mp4' }];
        if (changed === 'thumbnail') target.extras = { thumbnailMediaId: 'media-1' };
        if (changed === 'story') target.publishMode = 'story_sequence';
        if (changed === 'null-media') target.media = null;
      });
      if (changed === 'hash') input.contentHash = 'sha256-foreign';
      await expect(service.attach('org-a', occurrence.occurrenceId, 'text-attach', input))
        .rejects.toMatchObject({ reasonCode: 'RenderPayloadInvalid' });
      expect(db.occurrences[0].status).toBe('AWAITING_RENDER');
      expect(validation.validate).not.toHaveBeenCalled();
    });

  it.each(['provider-media-required', 'settings', 'too-long', 'expired-during-validation'])(
    'v3 provider validation rejects %s before post/Ready writes', async (changed) => {
      const facebook = new FacebookProvider();
      service = new PrePublishRenderService(db as any,
        new PostPayloadValidationService({ getSocialIntegration: () => facebook } as any));
      const { occurrence, input } = await textAttachment();
      if (changed === 'provider-media-required') db.posts[0].settings = JSON.stringify({ post_type: 'story' });
      if (changed === 'settings') db.posts[0].settings = JSON.stringify({ post_type: 'invalid' });
      if (changed === 'too-long') { input.targets[0].caption = 'x'.repeat(63207);
        input.contentHash = computeRenderContentHash({ occurrenceId: occurrence.occurrenceId, correlation: input.correlation, targets: input.targets, renderedAtUtc: input.renderedAtUtc }); }
      if (changed === 'expired-during-validation') jest.spyOn(facebook, 'checkValidity').mockImplementation(async () => {
        jest.setSystemTime(new Date(now.getTime() + 301_000)); return true as const;
      });
      await expect(service.attach('org-a', occurrence.occurrenceId, 'text-attach', input)).rejects.toMatchObject({
        reasonCode: changed === 'expired-during-validation' ? 'RenderTimedOut' : 'RenderPayloadInvalid',
      });
      expect(db.posts[0].content).toBeUndefined();
      expect(db.occurrences[0].status).toBe('AWAITING_RENDER');
    });

  it('v3 DTO permits exactly one explicit text target and refuses the malformed alternatives', async () => {
    const { input } = await textAttachment();
    expect(await validate(plainToInstance(PublicAttachRenderedDto, input))).toEqual([]);
    for (const targets of [[], [input.targets[0], input.targets[0]], [{ ...input.targets[0], contentMode: undefined }],
      [{ ...input.targets[0], contentMode: 'media', media: [] }], [{ ...input.targets[0], extras: { thumbnailMediaId: 'm' } }]]) {
      expect((await validate(plainToInstance(PublicAttachRenderedDto, { ...input, targets }))).length).toBeGreaterThan(0);
    }
  });

  it('v3 canonical text Unicode and media digests match the SDK goldens and bind the mode', () => {
    const base = { occurrenceId: 'occ-1', correlation: { crmSocialPostId: 'crm-1', snapshotId: 'snapshot-1', pharmacyGroupId: 'group-1' },
      renderedAtUtc: '2026-08-26T08:00:00+00:00' };
    const text: RenderTarget = { integrationId: 'integration-1', channel: 'facebook', contentMode: 'text_only', caption: 'Caffè pronto <ok>', media: [] };
    expect(computeRenderContentHash({ ...base, targets: [text] }))
      .toBe('sha256-f34d397f4d3b7d5fc787623725cfef6aafcc4bed131a11fb0cbf0c7f5dd545cd');
    const media: RenderTarget = { integrationId: 'integration-1', channel: 'youtube', contentMode: 'media', caption: 'Ready caption',
      media: [{ mediaId: 'media-1', kind: 'video', mime: 'video/mp4' }] };
    expect(computeRenderContentHash({ ...base, targets: [media] }))
      .toBe('sha256-bf381ad74fc1c555acfc9658df00d8a5732c57ed4bcc202e25d6ca5330695835');
    expect(computeRenderContentHash({ ...base, targets: [{ ...text, contentMode: 'media' }] }))
      .not.toBe(computeRenderContentHash({ ...base, targets: [text] }));
  });
});


describe('overdue journal render window', () => {
  const acceptedAt = new Date('2026-10-27T16:32:40.000Z');
  const frozenDate = '2026-10-27T14:19:00.3851409+01:00';
  const correlation: RenderCorrelation = { crmSocialPostId: 'crm-overdue', snapshotId: 'snapshot-frozen',
    pharmacyGroupId: 'group-a', pharmacyId: 'pharmacy-a' };
  let db: MemoryPrisma;
  let service: PrePublishRenderService;
  let validation: { validate: jest.Mock };
  let previousFlag: string | undefined;
  let previousSecret: string | undefined;
  let onSleep: ((milliseconds: number) => Promise<void>) | undefined;
  let delivered: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(acceptedAt);
    previousFlag = process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
    previousSecret = process.env.HAPPYM_RENDER_TOKEN_SECRET;
    process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED = 'true';
    process.env.HAPPYM_RENDER_TOKEN_SECRET = 'overdue-source-test-secret-more-than-32-bytes';
    db = new MemoryPrisma(); db.providerIdentifier = 'happym-test-fixture';
    validation = { validate: jest.fn().mockResolvedValue({ valid: true, errors: true, emptyContent: false, tooLong: false }) };
    service = new PrePublishRenderService(db as any, validation as any);
    onSleep = undefined;
    for (const key of Object.keys(mockWorkflowActivities)) delete mockWorkflowActivities[key];
    (executeChild as jest.Mock).mockReset();
    (sleep as jest.Mock).mockReset().mockImplementation(async (milliseconds: number) => {
      expect(typeof milliseconds).toBe('number');
      expect(milliseconds).toBeGreaterThan(0);
      jest.setSystemTime(new Date(Date.now() + milliseconds));
      if (onSleep) await onSleep(milliseconds);
    });
    mockWorkflowActivities.getPost = async (_organizationId, postId) => ({
      ...db.posts.find((row) => row.id === postId), integration: { providerIdentifier: db.providerIdentifier } });
    mockWorkflowActivities.ensureRenderOccurrence = (...args: any[]) => (service.ensureOccurrence as any)(...args);
    mockWorkflowActivities.markRenderAwaiting = (...args: any[]) => (service.markAwaiting as any)(...args);
    mockWorkflowActivities.getRenderWorkflowState = (...args: any[]) => (service.workflowState as any)(...args);
    mockWorkflowActivities.timeoutRenderOccurrence = (...args: any[]) => (service.timeout as any)(...args);
    mockWorkflowActivities.beginRenderPublishing = jest.fn(async () => { throw new Error('Synthetic must not enter real delivery'); });
    // Only the synthetic delivery activity is a stand-in. Its durable SQL journal,
    // synthetic profiles and external/runtime behavior are outside these cases.
    delivered = jest.fn(async (_org, postId, occurrenceId) => {
      expect(await service.workflowState('org-a', occurrenceId)).toEqual({ status: 'ReadyToPublish' });
      db.posts.find((row) => row.id === postId).state = 'SIMULATED';
      db.occurrences.find((row) => row.id === occurrenceId).status = 'SIMULATED';
      return { status: 'SimulatedPublished', postId, occurrenceId };
    });
    mockWorkflowActivities.deliverSyntheticFixture = delivered;
    mockWorkflowActivities.getSyntheticFixtureReadback = async () => ({ status: 'SimulatedPublished' });
  });
  afterEach(() => {
    jest.useRealTimers();
    if (previousFlag === undefined) delete process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
    else process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED = previousFlag;
    if (previousSecret === undefined) delete process.env.HAPPYM_RENDER_TOKEN_SECRET;
    else process.env.HAPPYM_RENDER_TOKEN_SECRET = previousSecret;
  });
  async function prepared(date = frozenDate, leadTimeSeconds = 600) {
    const value = { contract: scheduleIntentContract, commandId: 'command-overdue', crmOccurrenceId: 'crm-occ-overdue',
      revisionId: 'revision-frozen', bindingKey: 'binding-test', post: { type: 'schedule', date,
        shortLink: false, tags: [], posts: [{ integration: { id: 'integration-1' },
          value: [{ content: 'Frozen synthetic caption', image: [] }], settings: {},
          prePublishRender: { leadTimeSeconds, correlation } }] } };
    const payloadJson = JSON.stringify(value);
    const wire = { payloadJson, payloadHash: `sha256-${createHash('sha256').update(payloadJson).digest('hex')}` };
    const intents = new ScheduleIntentService(db as any);
    const receipt = await intents.create('org-a', 'intent-overdue', wire, value.post as any);
    expect(receipt.links).toHaveLength(1);
    const link = receipt.links[0];
    const ensure = () => service.ensureOccurrence('org-a', link.postId, link.integrationId, 0,
      new Date(date), leadTimeSeconds, correlation);
    const run = () => postWorkflowV107({ taskQueue: 'source-test-only', organizationId: 'org-a', postId: link.postId });
    return { value, wire, intents, receipt, link, ensure, run };
  }
  async function attachment(occurrenceId: string) {
    const claim = await service.claim('org-a', occurrenceId, 'worker-a', 'claim-a', 900);
    const targets: RenderTarget[] = [{ integrationId: 'integration-1', channel: 'happym-test-fixture',
      contentMode: 'text_only', caption: 'Frozen rendered synthetic caption', media: [] }];
    const input = { renderToken: claim.renderToken, correlation: { ...correlation }, targets,
      renderedAtUtc: new Date().toISOString(), contentHash: '' };
    input.contentHash = computeRenderContentHash({ occurrenceId, correlation: input.correlation, targets: input.targets, renderedAtUtc: input.renderedAtUtc });
    return { claim, input };
  }
  it('wires overdue Create -> one link -> Awaiting -> valid claim/attach -> synthetic workflow branch', async () => {
    const f = await prepared(); const first = await f.ensure();
    expect(first).toMatchObject({ renderDeadlineUtc: new Date(acceptedAt.getTime() + 600_000).toISOString(),
      scheduledFor: new Date(frozenDate), status: 'Scheduled' });
    await expect(service.assertPublishAllowed('org-a', f.link.postId)).rejects.toMatchObject({ reasonCode: 'PublishBlockedNoRender' });
    let attached = false;
    onSleep = async () => {
      if (attached) return; attached = true;
      expect(delivered).not.toHaveBeenCalled();
      expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'AwaitingRender' });
      const { input, claim } = await attachment(f.link.occurrenceId);
      expect(claim.leaseExpiresAt).toEqual(new Date(acceptedAt.getTime() + 600_000));
      expect((await service.attach('org-a', f.link.occurrenceId, 'attach-a', input)).status).toBe('ReadyToPublish');
    };
    await expect(f.run()).resolves.toMatchObject({ status: 'SimulatedPublished', occurrenceId: f.link.occurrenceId });
    expect((sleep as jest.Mock).mock.calls.map(([milliseconds]) => milliseconds)).toEqual([5000]);
    expect(delivered).toHaveBeenCalledTimes(1); expect(executeChild).not.toHaveBeenCalled();
    expect(validation.validate).toHaveBeenCalled();
    expect(db.intentRows[0]).toMatchObject({ payloadJson: f.wire.payloadJson, payloadHash: f.wire.payloadHash, createdAt: acceptedAt });
    expect(db.posts[0].publishDate).toEqual(new Date(frozenDate)); expect(db.occurrences).toHaveLength(1);
  });
  it('waits the finite journal budget then times out without attach or delivery', async () => {
    const f = await prepared(); await f.run();
    expect(Date.now()).toBe(acceptedAt.getTime() + 600_000);
    expect((sleep as jest.Mock).mock.calls).toHaveLength(120);
    expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'RenderTimedOut' });
    expect(delivered).not.toHaveBeenCalled(); expect(executeChild).not.toHaveBeenCalled();
  });
  it('late dispatch consumes only the remaining first-created budget', async () => {
    const f = await prepared(); jest.setSystemTime(new Date(acceptedAt.getTime() + 550_000));
    await f.run();
    expect((sleep as jest.Mock).mock.calls).toHaveLength(10);
    expect(Date.now()).toBe(acceptedAt.getTime() + 600_000); expect(delivered).not.toHaveBeenCalled();
  });
  it('exact replay and a new service instance never renew creation or the deadline', async () => {
    const f = await prepared(); const first = await f.ensure();
    jest.setSystemTime(new Date(acceptedAt.getTime() + 601_000));
    service = new PrePublishRenderService(db as any, validation as any);
    expect(await f.intents.create('org-a', 'intent-overdue', f.wire, f.value.post as any)).toEqual(f.receipt);
    expect(await f.ensure()).toEqual(first);
    expect(db.intentRows[0].createdAt).toEqual(acceptedAt); expect(db.occurrences[0].createdAt).toEqual(acceptedAt);
    await f.run();
    await expect(service.claim('org-a', f.link.occurrenceId, 'worker-a', 'claim-after-restart', 300))
      .rejects.toMatchObject({ reasonCode: 'RenderTimedOut' });
    expect(sleep).not.toHaveBeenCalled(); expect(delivered).not.toHaveBeenCalled();
    expect(db.posts).toHaveLength(1); expect(db.occurrences).toHaveLength(1);
  });
  it('future-at-creation remains on its original deadline after becoming due', async () => {
    const scheduled = new Date(acceptedAt.getTime() + 1_200_000);
    const f = await prepared(scheduled.toISOString());
    expect(await f.ensure()).not.toHaveProperty('renderDeadlineUtc');
    await service.markAwaiting('org-a', f.link.occurrenceId);
    jest.setSystemTime(new Date(acceptedAt.getTime() + 700_000));
    expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'AwaitingRender' });
    const claim = await service.claim('org-a', f.link.occurrenceId, 'worker-a', 'future-claim', 900);
    expect(claim.leaseExpiresAt).toEqual(scheduled);
    jest.setSystemTime(scheduled);
    expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'RenderTimedOut' });
    expect(await f.ensure()).not.toHaveProperty('renderDeadlineUtc');
  });
  it('future V107 without optional deadline retains lead timer, poll timer and original publish timer', async () => {
    const scheduled = new Date(acceptedAt.getTime() + 1_200_000);
    const f = await prepared(scheduled.toISOString()); let attached = false;
    expect(await f.ensure()).not.toHaveProperty('renderDeadlineUtc');
    onSleep = async (milliseconds) => {
      if (milliseconds !== 5000 || attached) return; attached = true;
      const { input } = await attachment(f.link.occurrenceId);
      await service.attach('org-a', f.link.occurrenceId, 'future-attach', input);
    };
    await f.run();
    expect((sleep as jest.Mock).mock.calls.map(([milliseconds]) => milliseconds)).toEqual([600_000, 5000, 595_000]);
    expect(Date.now()).toBe(scheduled.getTime()); expect(delivered).toHaveBeenCalledTimes(1);
    expect(executeChild).not.toHaveBeenCalled();
  });
  it.each(['absent', 'organization', 'state', 'dispatch', 'creation', 'post', 'occurrence', 'integration', 'multiple', 'malformed'])(
    'does not grant an overdue window with a %s journal proof', async (changed) => {
      const f = await prepared(); const row = db.intentRows[0]; const links = JSON.parse(row.linksJson);
      if (changed === 'absent') db.intentRows.length = 0;
      if (changed === 'organization') row.organizationId = 'org-b';
      if (changed === 'state') row.state = 'cancelled';
      if (changed === 'dispatch') row.dispatchState = 'cancelled';
      if (changed === 'creation') row.createdAt = new Date(acceptedAt.getTime() + 1);
      if (['post', 'occurrence', 'integration'].includes(changed)) {
        links[0][`${changed}Id`] = 'foreign'; row.linksJson = JSON.stringify(links);
      }
      if (changed === 'multiple') row.linksJson = JSON.stringify([links[0], links[0]]);
      if (changed === 'malformed') row.linksJson = '{';
      expect(await f.ensure()).not.toHaveProperty('renderDeadlineUtc');
      await f.run(); expect(delivered).not.toHaveBeenCalled(); expect(executeChild).not.toHaveBeenCalled();
      expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'RenderTimedOut' });
    });
  it('keeps an expired CRM render lease closed inside a still-open journal budget', async () => {
    const f = await prepared(); await service.markAwaiting('org-a', f.link.occurrenceId);
    await service.claim('org-a', f.link.occurrenceId, 'worker-a', 'short-claim', 60);
    jest.setSystemTime(new Date(acceptedAt.getTime() + 61_000));
    await expect(service.claim('org-a', f.link.occurrenceId, 'worker-a', 'short-claim', 900))
      .rejects.toMatchObject({ reasonCode: 'RenderTimedOut' });
    expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'RenderTimedOut' });
    await f.run(); expect(delivered).not.toHaveBeenCalled();
  });
  it.each(['token', 'correlation', 'channel', 'hash'])(
    'keeps overdue publication closed on an invalid %s attach', async (changed) => {
      const f = await prepared(); await service.markAwaiting('org-a', f.link.occurrenceId);
      const { input } = await attachment(f.link.occurrenceId);
      if (changed === 'token') input.renderToken = 'foreign-token';
      if (changed === 'correlation') input.correlation.snapshotId = 'different-snapshot';
      if (changed === 'channel') input.targets[0].channel = 'facebook';
      input.contentHash = computeRenderContentHash({ occurrenceId: f.link.occurrenceId, correlation: input.correlation, targets: input.targets, renderedAtUtc: input.renderedAtUtc });
      if (changed === 'hash') input.contentHash = 'sha256-foreign';
      await expect(service.attach('org-a', f.link.occurrenceId, 'invalid-attach', input))
        .rejects.toMatchObject({ reasonCode: 'RenderPayloadInvalid', statusCode: changed === 'token' ? 403 : 422 });
      expect(validation.validate).not.toHaveBeenCalled();
      expect(await service.workflowState('org-a', f.link.occurrenceId)).toEqual({ status: 'AwaitingRender' });
      await expect(service.assertPublishAllowed('org-a', f.link.postId)).rejects.toMatchObject({ reasonCode: 'PublishBlockedNoRender' });
      await f.run(); expect(delivered).not.toHaveBeenCalled(); expect(executeChild).not.toHaveBeenCalled();
    });
  it.each([60, 3600])('pins the configured %s-second budget to creation and clamps a claim', async (seconds) => {
    const f = await prepared(frozenDate, seconds);
    expect(await f.ensure()).toHaveProperty('renderDeadlineUtc', new Date(acceptedAt.getTime() + seconds * 1000).toISOString());
    await service.markAwaiting('org-a', f.link.occurrenceId);
    jest.setSystemTime(new Date(acceptedAt.getTime() + (seconds - 10) * 1000));
    const claim = await service.claim('org-a', f.link.occurrenceId, 'worker-a', 'near-deadline', 900);
    expect(claim.leaseExpiresAt).toEqual(new Date(acceptedAt.getTime() + seconds * 1000));
  });
  it('treats equality at creation as overdue while preserving the requested instant', async () => {
    const f = await prepared(acceptedAt.toISOString());
    expect(await f.ensure()).toMatchObject({ scheduledFor: acceptedAt,
      renderDeadlineUtc: new Date(acceptedAt.getTime() + 600_000).toISOString() });
  });
});
