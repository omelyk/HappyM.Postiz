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
    this.post = {
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
