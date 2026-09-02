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
          ? { providerIdentifier: this.providerIdentifier }
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
    service = new PrePublishRenderService(db as any);
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

    const restarted = new PrePublishRenderService(db as any);
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
});
