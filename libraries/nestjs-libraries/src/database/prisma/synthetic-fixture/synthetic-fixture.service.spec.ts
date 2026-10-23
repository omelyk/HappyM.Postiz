import { CreationMethod, Integration, Post, PrePublishRenderOccurrence, Prisma, SyntheticDeliveryEvent, SyntheticDeliveryReceipt } from '@prisma/client';
import { PostsService } from '../posts/posts.service';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { PrismaService } from '../prisma.service';
import { HappyMTestFixtureProvider } from '../../../integrations/social/happym-test-fixture.provider';
import { SYNTHETIC_PROVIDER, SYNTHETIC_PROFILES, SyntheticFixtureFault, SyntheticFixtureService,
  SyntheticProfile, syntheticBinding, syntheticIntegrationId } from './synthetic-fixture.service';

const env = {
  NODE_ENV: 'test' as const,
  HAPPYM_APPLIANCE_MODE: 'true', HAPPYM_TEST_FIXTURE_ENABLED: 'true',
  HAPPYM_PUBLISHING_SAFETY_MODE: 'test-deny-external', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST',
  HAPPYM_APPLIANCE_CLIENT_ID: 'client-a', HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID: 'test-a',
  HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID: 'deployment-a', HAPPYM_APPLIANCE_INSTALLATION_ID: 'installation-a',
};
const organizationId = 'organization-a', postId = 'post-a', occurrenceId = 'occurrence-a';

type FixtureOccurrence = Pick<PrePublishRenderOccurrence,
  'id' | 'organizationId' | 'postId' | 'integrationId' | 'scheduledFor' | 'status' | 'contentHash'
  | 'renderedPayload' | 'publishedAt' | 'releaseId' | 'releaseUrl' | 'publishReceipt'> & {
    integration: Integration;
    post: Pick<Post, 'id' | 'organizationId' | 'integrationId' | 'state' | 'deletedAt'
      | 'intervalInDays' | 'releaseId' | 'releaseURL'>;
  };

// Explicit in-file Prisma transaction seam, NOT PostgreSQL/CAS/Temporal/native
// proof. No socket/HTTP/provider/import-time execution or generic harness.
function fixture(profile: SyntheticProfile = 'success', slides = 2) {
  const binding = syntheticBinding(env), integrationId = syntheticIntegrationId(binding, organizationId, profile);
  const integration = { id: integrationId, organizationId, providerIdentifier: SYNTHETIC_PROVIDER,
    internalId: SYNTHETIC_PROVIDER + ':' + profile, type: 'social', token: 'happym-test-fixture:no-oauth',
    tokenExpiration: null, refreshToken: null, disabled: false, deletedAt: null, refreshNeeded: false,
    name: '[SIMULAZIONE] ' + profile } as Integration;
  const occurrence: FixtureOccurrence = { id: occurrenceId, organizationId, postId, integrationId, integration,
    scheduledFor: new Date(0), status: 'READY_TO_PUBLISH', contentHash: 'sha256-' + 'a'.repeat(64),
    renderedPayload: JSON.stringify({ targets: [{ integrationId, channel: SYNTHETIC_PROVIDER,
      media: Array.from({ length: slides }, (_, index) => ({ mediaId: 'media-' + index, kind: 'image', mime: 'image/png' })) }] }),
    publishedAt: null, releaseId: null, releaseUrl: null, publishReceipt: null,
    post: { id: postId, organizationId, integrationId, state: 'QUEUE', deletedAt: null,
      intervalInDays: null, releaseId: null, releaseURL: null } };
  let receipts: SyntheticDeliveryReceipt[] = [], events: SyntheticDeliveryEvent[] = [];
  let rejectCompletion = false;
  const tx = {
    organization: { findUnique: jest.fn(async () => ({ id: organizationId })) },
    integration: { findFirst: jest.fn(async () => integration), create: jest.fn() },
    nativeWorkspaceOwner31: { findUnique: jest.fn(async (): Promise<null> => null) },
    nativeConsumerScopeAdmission30: { findUnique: jest.fn(async (): Promise<null> => null) },
    $queryRaw: jest.fn(async () => [{ id: postId }]),
    prePublishRenderOccurrence: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; organizationId: string; postId: string } }) =>
        where.id === occurrenceId && where.organizationId === organizationId && where.postId === postId ? occurrence : null),
      updateMany: jest.fn(async () => { if (rejectCompletion) return { count: 0 }; occurrence.status = 'SIMULATED'; return { count: 1 }; }),
    },
    post: { updateMany: jest.fn(async () => { occurrence.post.state = 'SIMULATED'; return { count: 1 }; }) },
    syntheticDeliveryReceipt: {
      findMany: jest.fn(async () => receipts), count: jest.fn(async () => receipts.length),
      create: jest.fn(async ({ data }: { data: Omit<SyntheticDeliveryReceipt, 'createdAt'> }) => {
        if (receipts.some(row => row.scopeKey === data.scopeKey && row.slideIndex === data.slideIndex)) throw new Error('unique');
        const row = { ...data, createdAt: new Date(0) }; receipts.push(row); return row;
      }),
    },
    syntheticDeliveryEvent: {
      findMany: jest.fn(async () => events),
      create: jest.fn(async ({ data }: { data: Omit<SyntheticDeliveryEvent, 'createdAt'> }) => {
        if (events.some(row => row.scopeKey === data.scopeKey && row.ordinal === data.ordinal)) throw new Error('unique');
        const row = { ...data, createdAt: new Date(0) }; events.push(row); return row;
      }),
    },
  };
  const transaction = jest.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => {
    const saved = { receipts: [...receipts], events: [...events], state: occurrence.post.state, status: occurrence.status };
    try { return await callback(tx as unknown as Prisma.TransactionClient); }
    catch (error) { receipts = saved.receipts; events = saved.events; occurrence.post.state = saved.state; occurrence.status = saved.status; throw error; }
  });
  const prisma = { $transaction: transaction, organization: { findUnique: jest.fn(async () => ({ id: organizationId })) },
    integration: { findFirst: jest.fn(async () => integration), create: jest.fn() } } as unknown as PrismaService;
  return { service: new SyntheticFixtureService(prisma), integration, occurrence, tx, transaction,
    receipts: () => receipts, events: () => events, rejectCompletion: () => { rejectCompletion = true; } };
}

describe('isolated synthetic fixture Source contracts', () => {
  const original = process.env;
  beforeEach(() => { process.env = { ...env }; });
  afterEach(() => { process.env = original; });

  it.each(['HAPPYM_APPLIANCE_MODE', 'HAPPYM_TEST_FIXTURE_ENABLED', 'HAPPYM_APPLIANCE_CLIENT_ID',
    'HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID', 'HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID', 'HAPPYM_APPLIANCE_INSTALLATION_ID'])
  ('missing required declaration %s fails closed', key => {
    expect(() => syntheticBinding({ ...env, [key]: undefined })).toThrow();
  });
  it.each(['PROD', 'Unspecified', 'test'])('environment %s cannot enable synthetic sender', kind => {
    expect(() => syntheticBinding({ ...env, HAPPYM_APPLIANCE_ENVIRONMENT_KIND: kind })).toThrow();
  });
  it.each(['live', 'blocked', 'arbitrary'])('publishing mode %s cannot enable synthetic sender', mode => {
    expect(() => syntheticBinding({ ...env, HAPPYM_PUBLISHING_SAFETY_MODE: mode })).toThrow();
  });
  it('metadata provider cannot authenticate, refresh or return a fake provider receipt', async () => {
    const provider = new HappyMTestFixtureProvider();
    await expect(provider.authenticate()).rejects.toMatchObject({ type: 'SyntheticFixtureTransportForbidden' });
    await expect(provider.refreshToken()).rejects.toMatchObject({ type: 'SyntheticFixtureTransportForbidden' });
    await expect(provider.post()).rejects.toMatchObject({ type: 'SyntheticFixtureTransportForbidden' });
    await expect(provider.finalizePost()).rejects.toMatchObject({ type: 'SyntheticFixtureTransportForbidden' });
  });
  it('integration identity changes with client/environment/installation/organization/profile', () => {
    const binding = syntheticBinding(env), id = syntheticIntegrationId(binding, organizationId, 'success');
    expect(syntheticIntegrationId({ ...binding, clientId: 'client-b' }, organizationId, 'success')).not.toBe(id);
    expect(syntheticIntegrationId({ ...binding, applicationEnvironmentId: 'test-b' }, organizationId, 'success')).not.toBe(id);
    expect(syntheticIntegrationId({ ...binding, installationId: 'installation-b' }, organizationId, 'success')).not.toBe(id);
    expect(syntheticIntegrationId(binding, 'organization-b', 'success')).not.toBe(id);
    expect(syntheticIntegrationId(binding, organizationId, 'partial-slide')).not.toBe(id);
  });
  it('success commits two synthetic slides once and exact replay leaves events unchanged', async () => {
    const f = fixture(); const result = await f.service.deliver(organizationId, postId, occurrenceId);
    expect(result).toMatchObject({ mode: 'SIMULATION', status: 'SimulatedPublished' });
    expect(result.slides).toHaveLength(2); expect(f.occurrence.post.state).toBe('SIMULATED');
    expect(f.occurrence.post.releaseURL).toBeNull(); expect(f.occurrence.publishedAt).toBeNull();
    expect(result.slides[0]).not.toHaveProperty('providerId'); expect(result.slides[0]).not.toHaveProperty('releaseURL');
    const eventCount = f.events().length;
    expect(await f.service.deliver(organizationId, postId, occurrenceId)).toEqual(result);
    expect(f.events()).toHaveLength(eventCount); expect(f.receipts()).toHaveLength(2);
  });
  it('transient fault is consumed durably before any slide receipt and resumes only synthetic mutation', async () => {
    const f = fixture('transient-before-commit');
    await expect(f.service.deliver(organizationId, postId, occurrenceId)).rejects.toMatchObject({ code: 'SyntheticTransientBeforeCommit' });
    expect(f.receipts()).toHaveLength(0); expect(f.events().map(row => row.kind)).toEqual(['Attempted', 'TransientRejected']);
    expect((await f.service.readback(organizationId, postId, occurrenceId)).status).toBe('NotStarted');
    expect((await f.service.deliver(organizationId, postId, occurrenceId)).status).toBe('SimulatedPublished');
  });
  it('lost response follows durable complete commit and readback needs no second delivery', async () => {
    const f = fixture('lost-response-after-commit');
    await expect(f.service.deliver(organizationId, postId, occurrenceId)).rejects.toBeInstanceOf(SyntheticFixtureFault);
    expect(f.receipts()).toHaveLength(2); const count = f.events().length;
    expect((await f.service.readback(organizationId, postId, occurrenceId)).status).toBe('SimulatedPublished');
    expect(f.events()).toHaveLength(count); expect(f.events().filter(row => row.kind === 'ResponseLost')).toHaveLength(1);
  });
  it('partial multi-slide response resumes missing slides without duplicating the first receipt', async () => {
    const f = fixture('partial-slide');
    await expect(f.service.deliver(organizationId, postId, occurrenceId)).rejects.toMatchObject({ code: 'SyntheticOutcomeUnknown' });
    const first = f.receipts()[0].syntheticReceiptId;
    expect((await f.service.readback(organizationId, postId, occurrenceId)).status).toBe('Partial');
    expect((await f.service.deliver(organizationId, postId, occurrenceId)).status).toBe('SimulatedPublished');
    expect(f.receipts()).toHaveLength(2); expect(f.receipts()[0].syntheticReceiptId).toBe(first);
  });
  it('same scope with changed durable render hash is rejected before additional commits', async () => {
    const f = fixture(); await f.service.deliver(organizationId, postId, occurrenceId);
    const count = f.events().length; f.occurrence.contentHash = 'sha256-' + 'b'.repeat(64);
    await expect(f.service.deliver(organizationId, postId, occurrenceId)).rejects.toThrow();
    expect(f.receipts()).toHaveLength(2); expect(f.events()).toHaveLength(count);
  });
  it('failed conditional terminal write rolls back receipt/events in the transaction seam', async () => {
    const f = fixture(); f.rejectCompletion();
    await expect(f.service.deliver(organizationId, postId, occurrenceId)).rejects.toThrow();
    expect(f.receipts()).toHaveLength(0); expect(f.events()).toHaveLength(0);
    expect(f.occurrence.post.state).toBe('QUEUE');
  });
  it('readback requires exact organization/post/occurrence and never creates a receipt', async () => {
    const f = fixture();
    await expect(f.service.readback('organization-b', postId, occurrenceId)).rejects.toThrow();
    await expect(f.service.readback(organizationId, 'post-b', occurrenceId)).rejects.toThrow();
    await expect(f.service.readback(organizationId, postId, 'occurrence-b')).rejects.toThrow();
    expect(f.tx.syntheticDeliveryReceipt.create).not.toHaveBeenCalled();
  });
  it('provision requires additional native-purpose credential and exact TEST target binding', async () => {
    const f = fixture(), binding = syntheticBinding(env);
    await expect(f.service.provision({ organizationId, profile: 'success', binding }, undefined)).rejects.toThrow();
    process.env.HAPPYM_TEST_FIXTURE_NATIVE_SECRET = 'n'.repeat(48);
    await expect(f.service.provision({ organizationId, profile: 'success', binding: { ...binding, installationId: 'wrong' } }, 'n'.repeat(48))).rejects.toThrow();
    expect(await f.service.provision({ organizationId, profile: 'success', binding }, 'n'.repeat(48))).toMatchObject({ mode: 'SIMULATION', identifier: SYNTHETIC_PROVIDER });
  });
  it('fixed fault registry does not accept arbitrary caller fault settings', async () => {
    const f = fixture(); process.env.HAPPYM_TEST_FIXTURE_NATIVE_SECRET = 'n'.repeat(48);
    expect(SYNTHETIC_PROFILES).toHaveLength(4);
    await expect(f.service.provision({ organizationId, profile: 'arbitrary', binding: syntheticBinding(env) }, 'n'.repeat(48))).rejects.toThrow();
    await expect(f.service.provision({ organizationId, profile: 'success', binding: syntheticBinding(env), delay: 999 }, 'n'.repeat(48))).rejects.toThrow();
  });
  it.each(['draft', 'update', 'schedule', 'now'] as const)
  ('real createPost rejects moving a SIMULATED row through %s before provider or writes', async type => {
    const getPostById = jest.fn(async () => ({ state: 'SIMULATED' }));
    const getIntegrationById = jest.fn(); const createOrUpdatePost = jest.fn();
    const convertTextToShortLinks = jest.fn(); const startWorkflow = jest.fn();
    // Invoke the real method with strict dependencies. The constructor's storage
    // factory is intentionally not run; its IO is not part of this early guard.
    const service = Object.create(PostsService.prototype) as PostsService;
    Object.assign(service, { _postRepository: { getPostById, createOrUpdatePost },
      _integrationService: { getIntegrationById }, _shortLinkService: { convertTextToShortLinks }, startWorkflow });
    const body = { type, shortLink: true, republish: true, date: '2026-01-01T00:00:00Z', tags: [],
      posts: [{ integration: { id: 'real-facebook-integration' },
        value: [{ id: postId, content: 'changed', image: [], delay: 0 }], settings: { __type: 'facebook' } }] } as CreatePostDto;
    await expect(service.createPost(organizationId, body, CreationMethod.API)).rejects.toThrow();
    expect(getPostById).toHaveBeenCalledWith(postId, organizationId);
    expect(getIntegrationById).not.toHaveBeenCalled(); expect(convertTextToShortLinks).not.toHaveBeenCalled();
    expect(createOrUpdatePost).not.toHaveBeenCalled(); expect(startWorkflow).not.toHaveBeenCalled();
  });
});
