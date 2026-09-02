import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';

const response = (value: unknown) => ({
  json: async () => value,
});

describe('Story sequence provider receipts', () => {
  it('publishes Facebook slides in order and returns every child receipt', async () => {
    const provider = new FacebookProvider();
    (provider as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(response({ post_id: 'fb-story-1' }))
      .mockResolvedValueOnce(response({ post_id: 'fb-story-2' }));
    const integration = {
      internalId: 'page-1',
      profile: 'pharmacy',
    } as any;
    const first = await provider.finalizePost(
      'token',
      {
        postType: 'story',
        items: [
          { kind: 'photo', mediaId: 'photo-1' },
          { kind: 'photo', mediaId: 'photo-2' },
        ],
        publishedCount: 0,
        lastPostId: '',
        receipts: [],
        attempting: 0,
        confirmed: true,
      },
      integration
    );

    expect(first.status).toBe('pending');
    if (first.status !== 'pending') throw new Error('Expected pending');
    expect(first.pendingData.receipts).toEqual([
      expect.objectContaining({ slideIndex: 0, providerId: 'fb-story-1' }),
    ]);

    const completed = await provider.finalizePost(
      'token',
      {
        ...first.pendingData,
        attempting: 1,
        confirmed: true,
      },
      integration
    );
    expect(completed.status).toBe('completed');
    if (completed.status !== 'completed') throw new Error('Expected completed');
    expect(completed.receipts).toHaveLength(2);
    expect(completed.receipts?.map((item) => item.slideIndex)).toEqual([0, 1]);
  });

  it('publishes one Instagram slide per durable step and returns ordered receipts', async () => {
    const provider = new InstagramProvider();
    (provider as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(response({ id: 'ig-story-1' }))
      .mockResolvedValueOnce(response({ permalink: 'https://ig.test/1' }))
      .mockResolvedValueOnce(response({ id: 'ig-story-2' }))
      .mockResolvedValueOnce(response({ permalink: 'https://ig.test/2' }));
    const integration = {
      internalId: 'ig-1',
      profile: 'pharmacy',
    } as any;
    const pendingData = {
      type: 'graph.facebook.com',
      postType: 'stories' as const,
      containers: ['container-1', 'container-2'],
      receipts: [] as Array<{
        slideIndex: number;
        providerId: string;
        releaseUrl: string;
        providerContainerId?: string;
        recovered?: boolean;
      }>,
    };

    const first = await provider.finalizePost(
      'token___user-token',
      pendingData,
      integration
    );
    expect(first.status).toBe('pending');
    if (first.status !== 'pending') throw new Error('Expected pending');
    expect(first.pendingData.receipts).toEqual([
      expect.objectContaining({
        slideIndex: 0,
        providerId: 'ig-story-1',
        providerContainerId: 'container-1',
      }),
    ]);

    const completed = await provider.finalizePost(
      'token___user-token',
      first.pendingData,
      integration
    );
    expect(completed.status).toBe('completed');
    if (completed.status !== 'completed') throw new Error('Expected completed');
    expect(completed.receipts?.map((item) => item.providerId)).toEqual([
      'ig-story-1',
      'ig-story-2',
    ]);
  });
});
