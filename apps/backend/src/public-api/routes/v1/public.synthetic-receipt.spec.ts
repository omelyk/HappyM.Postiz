import { createHash } from 'node:crypto';
import type { Organization } from '@prisma/client';
import type { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import type { PrePublishRenderService } from '@gitroom/nestjs-libraries/database/prisma/prepublish-render/prepublish-render.service';
import { SyntheticFixtureService, SYNTHETIC_PROVIDER, syntheticBinding, syntheticIntegrationId } from
  '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { PublicPrePublishRenderController } from './public.prepublish-render.controller';

// The unrelated render boundary is not constructed. The controller and synthetic
// readback service below are production code; only Prisma reads are in-memory.
// No listener, HTTP client, database, sender or provider is started by this test.
jest.mock('@gitroom/nestjs-libraries/database/prisma/prepublish-render/prepublish-render.service', () => ({
  PrePublishRenderService: class {},
  PrePublishRenderError: class extends Error {},
}));

const environment = {
  HAPPYM_APPLIANCE_MODE: 'true', HAPPYM_TEST_FIXTURE_ENABLED: 'true',
  HAPPYM_PUBLISHING_SAFETY_MODE: 'test-deny-external', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST',
  HAPPYM_APPLIANCE_CLIENT_ID: 'client-a', HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID: 'test-a',
  HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID: 'deployment-a', HAPPYM_APPLIANCE_INSTALLATION_ID: 'installation-a',
};
const organizationId = 'organization-a', occurrenceId = 'occurrence-a', postId = 'post-a';
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function fixture() {
  const binding = syntheticBinding(environment);
  const integrationId = syntheticIntegrationId(binding, organizationId, 'success');
  const integration = { id: integrationId, organizationId, providerIdentifier: SYNTHETIC_PROVIDER,
    internalId: SYNTHETIC_PROVIDER + ':success', type: 'social', token: 'happym-test-fixture:no-oauth',
    refreshToken: null, tokenExpiration: null, disabled: false, deletedAt: null, refreshNeeded: false };
  const row = { id: occurrenceId, organizationId, postId, integrationId, integration,
    status: 'RENDER_TIMED_OUT', publishedAt: null, releaseId: null, releaseUrl: null, publishReceipt: null as string | null,
    contentHash: 'sha256-' + 'a'.repeat(64),
    renderedPayload: JSON.stringify({ targets: [{ integrationId, channel: SYNTHETIC_PROVIDER,
      caption: 'synthetic source content is not part of the response',
      media: [{ mediaId: 'media-a', kind: 'image', mime: 'image/png' }] }] }),
    post: { id: postId, organizationId, integrationId, state: 'QUEUE', deletedAt: null,
      intervalInDays: null, releaseId: null, releaseURL: null } };
  const scopeFields = { clientId: binding.clientId, environmentId: binding.applicationEnvironmentId,
    deploymentId: binding.logicalDeploymentId, installationId: binding.installationId,
    organizationId, integrationId, postId, occurrenceId };
  const scope = { scopeKey: hash(JSON.stringify(Object.values(scopeFields))), ...scopeFields };
  const receipts: Array<Record<string, unknown>> = [], events: Array<Record<string, unknown>> = [];
  const write = () => jest.fn(() => { throw new Error('Unexpected synthetic receipt mutation'); });
  const writes = { integration: write(), occurrence: write(), post: write(), receipt: write(),
    event: write(), queryRaw: write(), executeRaw: write() };
  const findFirst = jest.fn(async ({ where, select }: {
    where: { id: string; organizationId: string; postId?: string;
      integration?: { is: { providerIdentifier: string; organizationId: string } } };
    select?: { postId: boolean };
  }) => {
    if (where.id !== row.id || where.organizationId !== row.organizationId
      || where.postId !== undefined && where.postId !== row.postId
      || where.integration?.is.providerIdentifier !== integration.providerIdentifier
      || where.integration?.is.organizationId !== integration.organizationId) return null;
    return select ? { postId: row.postId } : row;
  });
  const findRows = (rows: Array<Record<string, unknown>>) => jest.fn(async (
    { where }: { where: Record<string, unknown> }) => rows.filter(value =>
      Object.entries(where).every(([key, expected]) => value[key] === expected)));
  const tx = {
    prePublishRenderOccurrence: { findFirst, updateMany: writes.occurrence },
    integration: { create: writes.integration }, post: { updateMany: writes.post },
    syntheticDeliveryReceipt: { findMany: findRows(receipts), create: writes.receipt },
    syntheticDeliveryEvent: { findMany: findRows(events), create: writes.event },
    $queryRaw: writes.queryRaw, $executeRaw: writes.executeRaw,
  };
  const transaction = jest.fn(async (action: (value: typeof tx) => Promise<unknown>) => action(tx));
  const service = new SyntheticFixtureService({ ...tx, $transaction: transaction } as unknown as PrismaService);
  const deliver = jest.spyOn(service, 'deliver'), provision = jest.spyOn(service, 'provision');
  const controller = new PublicPrePublishRenderController({} as PrePublishRenderService, service);
  return { controller, service, row, integration, findFirst, transaction, tx,
    get: (org = organizationId, id = occurrenceId) =>
      controller.syntheticReceipt({ id: org } as Organization, id),
    seedCompletedJournal() {
      row.status = 'SIMULATED'; row.post.state = 'SIMULATED';
      const bodyHash = hash(JSON.stringify([row.contentHash, occurrenceId, integrationId, 1]));
      receipts.push({ ...scope, bodyHash, slideIndex: 0, syntheticReceiptId: 'synthetic_' + 'b'.repeat(64) });
      for (const [index, kind] of ['Attempted', 'SlideCommitted', 'Completed'].entries())
        events.push({ ...scope, bodyHash, ordinal: index + 1, kind });
    },
    expectNoMutationOrSender() {
      for (const operation of Object.values(writes)) expect(operation).not.toHaveBeenCalled();
      expect(deliver).not.toHaveBeenCalled(); expect(provision).not.toHaveBeenCalled();
    } };
}

describe('authenticated occurrence synthetic receipt data-plane read', () => {
  const originalEnvironment = process.env;
  let current: ReturnType<typeof fixture>;
  beforeEach(() => {
    process.env = { ...environment };
    current = fixture();
  });
  afterEach(() => {
    try { current.expectNoMutationOrSender(); }
    finally { process.env = originalEnvironment; }
  });

  it('own organization derives the post and returns the existing NotStarted DTO without private fields', async () => {
    const result = await current.get();
    expect(result).toEqual({ contract: 'happym.synthetic-delivery/v1', mode: 'SIMULATION', status: 'NotStarted',
      organizationId, integrationId: current.integration.id, postId, occurrenceId, bodyHash: null, slides: [], events: [] });
    expect(current.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: occurrenceId, organizationId,
        integration: { is: { providerIdentifier: SYNTHETIC_PROVIDER, organizationId } } },
      select: { postId: true },
    });
    expect(JSON.stringify(result)).not.toMatch(/token|scopeKey|clientId|renderedPayload|caption|lease/i);
    expect(current.transaction).toHaveBeenCalledTimes(1);
  });

  it('own organization reads an already complete synthetic journal without delivering again', async () => {
    current.seedCompletedJournal();
    const result = await current.get();
    expect(result.status).toBe('SimulatedPublished');
    expect(result.organizationId).toBe(organizationId); expect(result.postId).toBe(postId);
    expect(result.occurrenceId).toBe(occurrenceId);
    expect(result.slides).toEqual([{ slideIndex: 0, syntheticReceiptId: 'synthetic_' + 'b'.repeat(64),
      status: 'SimulatedCommitted' }]);
    expect(result.events.map(value => value.kind)).toEqual(['Attempted', 'SlideCommitted', 'Completed']);
    expect(result.slides[0]).not.toHaveProperty('scopeKey');
    expect(current.transaction).toHaveBeenCalledTimes(1);
  });

  it('wrong organization is 404 before reading any journal', async () => {
    await expect(current.get('organization-b')).rejects.toMatchObject({
      status: 404, response: { code: 'synthetic_scope_missing' },
    });
    expect(current.transaction).not.toHaveBeenCalled();
    expect(current.tx.syntheticDeliveryReceipt.findMany).not.toHaveBeenCalled();
    expect(current.tx.syntheticDeliveryEvent.findMany).not.toHaveBeenCalled();
  });

  it('missing occurrence is 404 and cannot select a caller-supplied post', async () => {
    await expect(current.get(organizationId, 'occurrence-missing')).rejects.toMatchObject({
      status: 404, response: { code: 'synthetic_scope_missing' },
    });
    expect(current.transaction).not.toHaveBeenCalled();
  });

  it('an own-organization real provider occurrence is closed with 404', async () => {
    current.integration.providerIdentifier = 'facebook';
    await expect(current.get()).rejects.toMatchObject({
      status: 404, response: { code: 'synthetic_scope_missing' },
    });
    expect(current.transaction).not.toHaveBeenCalled();
  });

  it('fixture-disabled operation retains the existing 403 guard', async () => {
    process.env.HAPPYM_TEST_FIXTURE_ENABLED = 'false';
    await expect(current.get()).rejects.toMatchObject({
      status: 403, response: { code: 'synthetic_fixture_not_enabled' },
    });
    expect(current.transaction).not.toHaveBeenCalled();
  });

  it('the existing real-publication receipt guard remains 409 without exposing the receipt body', async () => {
    current.row.publishReceipt = '{"private":"not a synthetic receipt"}';
    await expect(current.get()).rejects.toMatchObject({
      status: 409, response: { code: 'synthetic_real_receipt_forbidden' },
    });
    expect(current.tx.syntheticDeliveryReceipt.findMany).not.toHaveBeenCalled();
  });
});
