import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { Provider, Role } from '@prisma/client';
import { HappyMApplianceService } from './happym.appliance.service';

// Deterministic Prisma transport fixtures, not native/DB/TEST deployment evidence.
describe('QA-only native consumer first-write/exact bootstrap', () => {
  const savedEnvironment = { ...process.env };
  const purpose = 'p'.repeat(32), nativeKey = 'k'.repeat(48);
  const orgId = 'hm-8e92cf7cfaf319223fd619c88951a2eae011b64ad8e9554da1a3f3d75eac29ce';
  const userId = 'sm.8e92cf7cfaf319223fd619c88951a2eae011b64ad8e9554da1a3f3d75eac29ce';
  const email = '8e92cf7cfaf319223fd619c88951a2eae011b64ad8e9554da1a3f3d75eac29ce@social-manager.local';
  const binding = { clientId: 'client-a', applicationEnvironmentId: 'environment-test',
    logicalDeploymentId: 'deployment-test', installationId: 'installation-a' };
  const request = (requireExisting = false) => ({ binding: { ...binding },
    consumer: { deploymentId: 'deployment-test', environment: 'test', tenantId: 'group-a', pharmacyId: 'pharmacy-a' },
    requestId: 'request-a', requireExisting });

  beforeEach(() => {
    process.env = { ...savedEnvironment,
      HAPPYM_APPLIANCE_MODE: 'true', HAPPYM_TEST_FIXTURE_ENABLED: 'true', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST',
      HAPPYM_PUBLISHING_SAFETY_MODE: 'test-deny-external', HAPPYM_APPLIANCE_CLIENT_ID: binding.clientId,
      HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID: binding.applicationEnvironmentId,
      HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID: binding.logicalDeploymentId,
      HAPPYM_APPLIANCE_INSTALLATION_ID: binding.installationId,
      HAPPYM_TEST_FIXTURE_NATIVE_SECRET: purpose, HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET: 'c'.repeat(32),
      HAPPYM_EMBED_CLIENT_SECRET: 'e'.repeat(32) };
    jest.spyOn(AuthService, 'fixedEncryption').mockReturnValue(nativeKey);
    jest.spyOn(AuthService, 'hashPassword').mockReturnValue('synthetic-hash-not-a-password');
  });
  afterEach(() => { process.env = { ...savedEnvironment }; jest.restoreAllMocks(); });

  function repository() {
    let state: { organization: any; user: any; memberships: any[] } = { organization: null, user: null, memberships: [] };
    let lostResponse = false, changeBinding = false, during: string | null = null, keyCollision = false;
    const observe = (stage: string) => {
      // Deterministic dependency completion, not a real native ownership proof.
      if (during === stage) process.env.HAPPYM_APPLIANCE_INSTALLATION_ID = 'changed-installation';
    };
    const tx = {
      organization: {
        findUnique: jest.fn(async ({ where }: any) => {
          const result = where.id === 'system-org' ? { apiKey: 's'.repeat(48) } : state.organization;
          observe(where.id === 'system-org' ? 'system-read' : 'organization-read'); return result;
        }),
        findFirst: jest.fn(async () => { observe('collision-read'); return keyCollision ? { id: 'other-organization' } : null; }),
        create: jest.fn(async ({ data }: any) => {
          state.organization = { id: data.id, name: data.name, apiKey: data.apiKey,
            allowTrial: data.allowTrial, isTrailing: data.isTrailing };
          observe('organization-create'); return state.organization;
        }),
      },
      user: {
        findUnique: jest.fn(async ({ where }: any) => {
          const result = where.id ? state.user
            : state.user && state.user.email === where.email_providerName.email ? { id: state.user.id } : null;
          observe(where.id ? 'user-read' : 'email-read'); return result;
        }),
        create: jest.fn(async ({ data }: any) => {
          state.user = { id: data.id, email: data.email, name: data.name,
            providerName: data.providerName, activated: data.activated };
          observe('user-create'); return state.user;
        }),
      },
      userOrganization: {
        findMany: jest.fn(async () => { observe('memberships-read'); return state.memberships; }),
        create: jest.fn(async ({ data }: any) => {
          state.memberships.push({ ...data }); observe('membership-create'); return { userId: data.userId };
        }),
      },
    };
    const prisma = { $transaction: jest.fn(async (body: any) => {
      const before = JSON.stringify(state);
      let result;
      try { result = await body(tx); }
      catch (error) { state = JSON.parse(before); throw error; }
      if (changeBinding) process.env.HAPPYM_APPLIANCE_INSTALLATION_ID = 'changed-installation';
      if (lostResponse) throw new Error(nativeKey);
      return result;
    }) };
    const service = new HappyMApplianceService(prisma as never, {} as never);
    // Only dependency substitution for deterministic service tests: not readiness proof.
    jest.spyOn(service as any, 'assertReady').mockImplementation(() => {});
    jest.spyOn(service as any, 'configuration').mockReturnValue({ systemOrganizationId: 'system-org' });
    return { service, prisma, tx, get state() { return state; },
      loseResponse() { lostResponse = true; }, changeBinding() { changeBinding = true; },
      changeDuring(stage: string) { during = stage; }, collideKey() { keyCollision = true; } };
  }

  it('creates a workspace once and preserves identical user, membership and key on explicit replay', async () => {
    const r = repository();
    const first = await r.service.bootstrapNativeConsumer(request(), purpose);
    const replay = await r.service.bootstrapNativeConsumer(request(true), purpose);
    expect(first).toEqual({ contract: 'happym.native-consumer-bootstrap/v1', binding,
      consumer: request().consumer, requestId: 'request-a', organizationId: orgId, userId, apiKey: nativeKey });
    expect(replay).toEqual(first);
    expect(r.state.user).toEqual({ id: userId, email, name: orgId, providerName: Provider.LOCAL, activated: true });
    expect(r.state.memberships).toEqual([{ userId, organizationId: orgId, role: Role.USER, disabled: false }]);
    expect(r.tx.organization.create).toHaveBeenCalledTimes(1);
    expect(r.tx.user.create).toHaveBeenCalledTimes(1);
    expect(r.tx.userOrganization.create).toHaveBeenCalledTimes(1);
  });

  it('requireExisting rejects a missing first workspace without any create', async () => {
    const r = repository();
    await expect(r.service.bootstrapNativeConsumer(request(true), purpose)).rejects.toMatchObject({ status: 409 });
    expect(r.tx.organization.create).not.toHaveBeenCalled();
    expect(r.tx.user.create).not.toHaveBeenCalled();
    expect(r.tx.userOrganization.create).not.toHaveBeenCalled();
  });

  it('requireExisting rejects a removed membership instead of restoring it', async () => {
    const r = repository(); await r.service.bootstrapNativeConsumer(request(), purpose);
    r.state.memberships.length = 0;
    await expect(r.service.bootstrapNativeConsumer(request(true), purpose)).rejects.toMatchObject({ status: 409 });
    expect(r.tx.userOrganization.create).toHaveBeenCalledTimes(1);
    expect(r.state.memberships).toEqual([]);
  });

  it.each(['disabled', 'role', 'user-active', 'email', 'org-name', 'system-key', 'control-key', 'other-membership'])
  ('rejects conflicting %s without changing or rotating any existing row', async mutation => {
    const r = repository(); await r.service.bootstrapNativeConsumer(request(), purpose);
    if (mutation === 'disabled') r.state.memberships[0].disabled = true;
    if (mutation === 'role') r.state.memberships[0].role = Role.ADMIN;
    if (mutation === 'user-active') r.state.user.activated = false;
    if (mutation === 'email') r.state.user.email = 'other@social-manager.local';
    if (mutation === 'org-name') r.state.organization.name = 'other';
    if (mutation === 'system-key') r.state.organization.apiKey = 's'.repeat(48);
    if (mutation === 'control-key') r.state.organization.apiKey = 'c'.repeat(32);
    if (mutation === 'other-membership') r.state.memberships[0].organizationId = 'other';
    const before = JSON.stringify(r.state);
    await expect(r.service.bootstrapNativeConsumer(request(), purpose)).rejects.toMatchObject({ status: 409 });
    expect(JSON.stringify(r.state)).toEqual(before);
    expect(r.tx.organization.create).toHaveBeenCalledTimes(1);
    expect(r.tx.user.create).toHaveBeenCalledTimes(1);
    expect(r.tx.userOrganization.create).toHaveBeenCalledTimes(1);
  });

  it.each(['wrong-binding', 'prod', 'other-deployment', 'unicode-scope', 'extra-field', 'missing-require-existing', 'purpose'])
  ('rejects %s before a transaction', async mutation => {
    const r = repository(); const input: any = request();
    if (mutation === 'wrong-binding') input.binding.installationId = 'other';
    if (mutation === 'prod') input.consumer.environment = 'prod';
    if (mutation === 'other-deployment') input.consumer.deploymentId = 'other';
    if (mutation === 'unicode-scope') input.consumer.tenantId = 'group-Ã¨';
    if (mutation === 'extra-field') input.apiKey = nativeKey;
    if (mutation === 'missing-require-existing') delete input.requireExisting;
    await expect(r.service.bootstrapNativeConsumer(input, mutation === 'purpose' ? 'wrong-purpose' : purpose)).rejects.toBeDefined();
    expect(r.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['system-read', 'organization-read', 'user-read', 'email-read', 'memberships-read', 'collision-read',
    'organization-create', 'user-create', 'membership-create'])
  ('rechecks a changed binding immediately after %s before the next mutation', async stage => {
    const r = repository(); r.changeDuring(stage);
    await expect(r.service.bootstrapNativeConsumer(request(), purpose)).rejects.toMatchObject({ status: 503 });
    const writes = stage.endsWith('-create');
    expect(r.tx.organization.create).toHaveBeenCalledTimes(writes ? 1 : 0);
    expect(r.tx.user.create).toHaveBeenCalledTimes(stage === 'user-create' || stage === 'membership-create' ? 1 : 0);
    expect(r.tx.userOrganization.create).toHaveBeenCalledTimes(stage === 'membership-create' ? 1 : 0);
    // A changed first read must not even proceed to another identity read;
    // a changed organization create must not proceed to user creation.
    if (stage === 'system-read') expect(r.tx.organization.findUnique).toHaveBeenCalledTimes(1);
    expect(r.state).toEqual({ organization: null, user: null, memberships: [] });
  });

  it.each([false, true])
  ('rejects a candidate key owned by another organization before any new mutation, existing=%s', async existing => {
    const r = repository();
    if (existing) await r.service.bootstrapNativeConsumer(request(), purpose);
    r.collideKey();
    const before = JSON.stringify(r.state);
    await expect(r.service.bootstrapNativeConsumer(request(existing), purpose)).rejects.toMatchObject({ status: 409 });
    expect(r.tx.organization.findFirst).toHaveBeenLastCalledWith({
      where: { apiKey: nativeKey, id: { not: orgId } }, select: { id: true } });
    expect(JSON.stringify(r.state)).toEqual(before);
    expect(r.tx.organization.create).toHaveBeenCalledTimes(existing ? 1 : 0);
    expect(r.tx.user.create).toHaveBeenCalledTimes(existing ? 1 : 0);
    expect(r.tx.userOrganization.create).toHaveBeenCalledTimes(existing ? 1 : 0);
  });

  it('does not retry ambiguous transaction completion or expose the error body', async () => {
    const r = repository(); r.loseResponse();
    let error: any;
    try { await r.service.bootstrapNativeConsumer(request(), purpose); } catch (caught) { error = caught; }
    expect(error.getResponse()).toEqual({ code: 'native_consumer_outcome_unknown' });
    expect(String(error)).not.toContain(nativeKey);
    expect(r.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(r.state.organization.id).toBe(orgId);
  });

  it('keeps a commit with changed engine binding UNKNOWN and returns no key envelope', async () => {
    const r = repository(); r.changeBinding();
    await expect(r.service.bootstrapNativeConsumer(request(), purpose)).rejects.toMatchObject({ status: 503 });
    expect(r.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(r.state.organization.id).toBe(orgId);
  });
});
