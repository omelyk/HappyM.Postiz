import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { NativeOperationalConsumer31Service, operationalId31, requireAdministrator31 } from './happym.operational-consumer31';
import { NativeConsumerAdmission30Service, workspace30 } from './happym.native-consumer-admission30';
import { requireOperationalCatalog31 } from './happym.operational-schema31';
import { SyntheticFixtureService, syntheticBinding, syntheticIntegrationId } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';

// Actual services with a rollback-capable in-file adapter. No PostgreSQL,
// listener, native authority, Docker, migration or runtime qualification.
describe('operational consumer31 finite SYSTEM registration', () => {
  const original = { ...process.env }, purpose = 'p'.repeat(48), systemKey = 's'.repeat(48);
  const consumer = { clientId: 'client-a', applicationEnvironmentId: 'qa', logicalDeploymentId: 'deployment-a', serviceId: 'crm' };
  let records: Map<string, any>, owners: Map<string, any>, diagnostics: Map<string, any>, organizations: Map<string, any>;
  let db: any, tx: any, inside: boolean, disabled: boolean, service: NativeOperationalConsumer31Service;
  beforeEach(() => {
    process.env = { ...original, HAPPYM_APPLIANCE_MODE: 'true', HAPPYM_TEST_FIXTURE_ENABLED: 'true',
      HAPPYM_PUBLISHING_SAFETY_MODE: 'test-deny-external', HAPPYM_APPLIANCE_ENVIRONMENT_KIND: 'TEST',
      HAPPYM_APPLIANCE_CLIENT_ID: 'owner', HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID: 'test',
      HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID: 'shared', HAPPYM_APPLIANCE_INSTALLATION_ID: 'install',
      HAPPYM_TEST_FIXTURE_NATIVE_SECRET: purpose, HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET: 'c'.repeat(48), HAPPYM_EMBED_CLIENT_SECRET: 'e'.repeat(48) };
    records = new Map(); owners = new Map(); diagnostics = new Map(); organizations = new Map(); inside = false; disabled = false;
    tx = {
      $executeRaw: jest.fn(async () => 0), $queryRaw: jest.fn(async () => [{ locked: true }]),
      organization: { findUnique: jest.fn(async ({ where }: any) => {
        if (where.id !== 'happym-system') return organizations.get(where.id) ?? null;
        if (!inside) throw new Error('actual SYSTEM must be queried inside the transaction');
        return { id: 'happym-system', apiKey: systemKey, users: [{ role: Role.ADMIN, disabled, user: { id: 'admin' } }] };
      }) }, user: { findUnique: jest.fn(async (): Promise<null> => null) },
      nativeWorkspaceOwner31: {
        findUnique: jest.fn(async ({ where }: any) => owners.get(where.organizationId) ?? null),
        create: jest.fn(async ({ data }: any) => { if (owners.has(data.organizationId) || [...owners.values()].some(x => x.userId === data.userId)) throw new Error('unique-owner'); owners.set(data.organizationId, data); return data; }),
      },
      nativeOperationalRegistration31: {
        findUnique: jest.fn(async ({ where }: any) => where.operationId ? records.get(where.operationId) ?? null : [...records.values()].find(x => x.requestId === where.requestId) ?? null),
        findFirst: jest.fn(async ({ where }: any) => [...records.values()].filter(x => x.consumerKey === where.consumerKey).sort((a, b) => b.revision - a.revision)[0] ?? null),
        create: jest.fn(async ({ data }: any) => { if ([...records.values()].some(x => x.requestId === data.requestId || x.consumerKey === data.consumerKey && x.revision === data.revision)) throw new Error('unique-registration'); records.set(data.operationId, data); return data; }),
      },
      nativeConsumerAdmission30: {
        findUnique: async ({ where }: any) => diagnostics.get(where.admissionId) ?? null,
        create: async ({ data }: any) => { const value = { ...data, scopes: data.scopes.create }; diagnostics.set(data.admissionId, value); return value; },
      },
      nativeConsumerScopeAdmission30: { findUnique: async ({ where }: any) => [...diagnostics.values()].flatMap(x => x.scopes.map((s: any) => ({ ...s, admissionId: x.admissionId }))).find(x => x.organizationId === where.organizationId) ?? null },
      integration: { findFirst: jest.fn(async (): Promise<null> => null), create: jest.fn(async ({ data }: any) => ({ ...data, refreshToken: null, tokenExpiration: null, deletedAt: null })) },
    };
    db = { ...tx, $transaction: jest.fn(async (body: any) => {
      const previous = structuredClone({ records, owners, diagnostics }); inside = true;
      try { return await body(tx); }
      catch (error) { records = previous.records; owners = previous.owners; diagnostics = previous.diagnostics; throw error; }
      finally { inside = false; }
    }) };
    service = new NativeOperationalConsumer31Service(db, 'happym-system', 'admin@example.test');
  });
  afterEach(() => { process.env = { ...original }; });
  const input = () => ({ contract: 'happym.postiz-operational-register31/v1', applianceBinding: syntheticBinding(), consumerBinding: consumer,
    requestId: 'a'.repeat(32), inputSha256: 'b'.repeat(64), previousOperationId: null as string | null,
    notAfterUtc: new Date(Date.now() + 600_000).toISOString(),
    scopes: Array.from({ length: 7 }, (_, index) => ({ packagePharmacyKey: 'pharmacy-' + (index + 1), tenantId: 'group-a', pharmacyId: 'pharmacy-' + (index + 1) })) });
  const register = (request = input(), key: unknown = systemKey) => service.register(request, purpose, key, 'happym-system');
  const boundHeader = (request: ReturnType<typeof input>) => Buffer.from(JSON.stringify({ applianceBinding: request.applianceBinding,
    consumerBinding: request.consumerBinding, requestId: request.requestId, inputSha256: request.inputSha256 })).toString('base64');

  it('registers all seven only with actual active SYSTEM membership inside the mutating transaction', async () => {
    const request = input(), result = await register(request);
    expect(result.scopes).toHaveLength(7); expect(result.administrator).toEqual({ organizationId: 'happym-system', userId: 'admin' });
    expect(owners.size).toBe(7); expect(records.size).toBe(1); expect(diagnostics.size).toBe(0);
    expect(await service.read(result.operationId)).toEqual(result);
    expect(JSON.stringify(result)).not.toContain(systemKey); expect(JSON.stringify(result)).not.toContain(purpose);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(8); // Consumer plus globally sorted seven org locks.
    expect(db.$transaction.mock.calls[0][1].isolationLevel).toBe(Prisma.TransactionIsolationLevel.Serializable);
  });
  it.each([null, 'c'.repeat(48), purpose, 'ordinary-scoped-key'.repeat(3)])('diagnostic/browser/scoped credential %s cannot grant seven', async key => {
    await expect(register(input(), key)).rejects.toBeDefined(); expect(records.size).toBe(0); expect(owners.size).toBe(0);
  });
  it('rejects a disabled actual administrative membership without publishing owner rows', async () => {
    disabled = true; await expect(register()).rejects.toBeInstanceOf(ForbiddenException); expect(owners.size).toBe(0);
  });
  it('requires both the real key equality and configured active admin user query', async () => {
    inside = true; await requireAdministrator31(tx, systemKey, 'happym-system', 'happym-system', 'admin@example.test'); inside = false;
    const query = tx.organization.findUnique.mock.calls[0][0];
    expect(query.select.users.where.user).toMatchObject({ email: 'admin@example.test', activated: true, providerName: 'LOCAL' });
  });
  it('does not repeat a registration POST and renews only using a fresh request with exact previous-operation CAS', async () => {
    const request = input(), first = await register(request);
    await expect(register(request)).rejects.toBeInstanceOf(ConflictException);
    await expect(register({ ...input(), requestId: 'c'.repeat(32) })).rejects.toBeInstanceOf(ConflictException);
    const next = await register({ ...input(), requestId: 'd'.repeat(32), previousOperationId: first.operationId });
    expect(next.revision).toBe(2); expect(records.size).toBe(2); expect(owners.size).toBe(7);
  });
  it('observes actual Absent by an authenticated bound GET without enrollment or repair', async () => {
    const request = input(), id = operationalId31(request.applianceBinding, consumer, request.requestId, request.inputSha256);
    expect((await service.inspectRegistration(id, purpose, systemKey, 'happym-system', boundHeader(request))).state).toBe('Absent');
    expect(tx.$executeRaw).toHaveBeenCalled(); expect(records.size).toBe(0); expect(owners.size).toBe(0);
    await expect(service.inspectRegistration(id, purpose, systemKey, 'happym-system', boundHeader({ ...request, consumerBinding: { ...consumer, clientId: 'foreign' } })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
  it('lazily adopts only an exact validated legacy diagnostic receipt inside the same transaction', async () => {
    const request = input(); const diagnostics30 = new NativeConsumerAdmission30Service(db);
    const old = await diagnostics30.enroll({ contract: 'happym.native-consumer-enroll/v1', applianceBinding: request.applianceBinding,
      consumerBinding: consumer, requestId: 'e'.repeat(32), requireExisting: false,
      scopes: request.scopes.slice(0, 2).map(({ tenantId, pharmacyId }) => ({ tenantId, pharmacyId })) }, purpose);
    owners.clear(); organizations.set(old.scopes[0].organizationId, { id: old.scopes[0].organizationId });
    const result = await register(request); expect(result.scopes).toHaveLength(7); expect(old.scopes).toHaveLength(2); expect(diagnostics.size).toBe(1);
    expect(await diagnostics30.read(old.admissionId)).toEqual(old);
  });
  it('refuses an existing unclaimed deterministic organization without a genuine diagnostic claim', async () => {
    const request = input(), ids = workspace30(consumer, request.scopes[6]); organizations.set(ids.organizationId, { id: ids.organizationId });
    await expect(register(request)).rejects.toBeInstanceOf(ConflictException); expect(records.size).toBe(0); expect(owners.size).toBe(0);
  });
  it('one physical common owner fences foreign claims and owner tampering invalidates public readback', async () => {
    const request = input(), ids = workspace30(consumer, request.scopes[0]);
    owners.set(ids.organizationId, { ...ids, consumerKey: 'f'.repeat(64), metadataJson: '{}' });
    await expect(register(request)).rejects.toBeInstanceOf(ConflictException); owners.clear();
    const result = await register(request); owners.get(ids.organizationId).metadataJson = '{}';
    await expect(service.read(result.operationId)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('scope writes recheck current SYSTEM inside the actual transaction and deny an eighth pharmacy', async () => {
    const r = await register(), scope = { deploymentId: consumer.logicalDeploymentId, environment: 'test', tenantId: 'group-a', pharmacyId: 'pharmacy-7' };
    await db.$transaction((client: Prisma.TransactionClient) => service.requireScope(r.operationId, r.applianceBinding, consumer, scope, purpose, systemKey, 'happym-system', client, true));
    await expect(db.$transaction((client: Prisma.TransactionClient) => service.requireScope(r.operationId, r.applianceBinding, consumer,
      { ...scope, pharmacyId: 'foreign' }, purpose, systemKey, 'happym-system', client, true))).rejects.toBeInstanceOf(ForbiddenException);
    disabled = true;
    await expect(db.$transaction((client: Prisma.TransactionClient) => service.requireScope(r.operationId, r.applianceBinding, consumer, scope, purpose, systemKey, 'happym-system', client, true))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['success', 'transient-before-commit', 'lost-response-after-commit', 'partial-slide'] as const)('fixture %s creation executes its actual administrator guard in the same transaction; legacy purpose cannot create operational scopes', async profile => {
    const r = await register(), scope = r.scopes[6]; organizations.set(scope.organizationId, { id: scope.organizationId });
    const fixtures = new SyntheticFixtureService(db); const request = { binding: r.applianceBinding, organizationId: scope.organizationId, profile };
    await expect(fixtures.provision(request, purpose)).rejects.toBeInstanceOf(ForbiddenException); expect(tx.integration.create).not.toHaveBeenCalled();
    const authorize = async (client: Prisma.TransactionClient) => { expect(inside).toBe(true); await service.requireScope(r.operationId, r.applianceBinding,
      consumer, { deploymentId: consumer.logicalDeploymentId, environment: 'test', tenantId: scope.tenantId, pharmacyId: scope.pharmacyId }, purpose, systemKey, 'happym-system', client, true); };
    const result = await fixtures.provisionAuthorized31(request, purpose, authorize);
    expect(result.integrationId).toBe(syntheticIntegrationId(r.applianceBinding, scope.organizationId, profile)); expect(tx.integration.create).toHaveBeenCalledTimes(1);
    tx.integration.findFirst.mockImplementationOnce(async () => ({ id: result.integrationId }));
    await expect(fixtures.provisionAuthorized31(request, purpose, authorize)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.integration.create).toHaveBeenCalledTimes(1); // A late uncertain creator wins; never repeat its mutation.
    disabled = true; await expect(fixtures.provisionAuthorized31(request, purpose, authorize)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.integration.create).toHaveBeenCalledTimes(1);
  });
  it('expired authorization cannot mutate while the immutable historical public receipt remains readable', async () => {
    const result = await register(), row = records.get(result.operationId), receipt = JSON.parse(row.receiptJson);
    receipt.notAfterUtc = '2020-01-01T00:00:00.000Z'; row.receiptJson = JSON.stringify(receipt);
    expect((await service.read(result.operationId)).notAfterUtc).toBe(receipt.notAfterUtc);
    await expect(db.$transaction((client: Prisma.TransactionClient) => service.requireScope(result.operationId, result.applianceBinding, consumer,
      { deploymentId: consumer.logicalDeploymentId, environment: 'test', tenantId: 'group-a', pharmacyId: 'pharmacy-1' }, purpose, systemKey, 'happym-system', client, true))).rejects.toBeInstanceOf(ForbiddenException);
  });

  const catalog = () => {
    const columns = [ ['NativeWorkspaceOwner31', 'organizationId', 'text'], ['NativeWorkspaceOwner31', 'userId', 'text'],
      ['NativeWorkspaceOwner31', 'consumerKey', 'character(64)'], ['NativeWorkspaceOwner31', 'metadataJson', 'text'],
      ['NativeOperationalRegistration31', 'operationId', 'character(64)'], ['NativeOperationalRegistration31', 'requestId', 'character(32)'],
      ['NativeOperationalRegistration31', 'consumerKey', 'character(64)'], ['NativeOperationalRegistration31', 'revision', 'integer'],
      ['NativeOperationalRegistration31', 'previousOperationId', 'character(64)'], ['NativeOperationalRegistration31', 'receiptJson', 'text'],
    ].map(([tableName, columnName, type]) => ({ tableName, columnName, type, notNull: columnName !== 'previousOperationId', canSelect: true, canInsert: true }));
    const constraints: any[] = [['NativeWorkspaceOwner31', 'p', ['organizationId']], ['NativeWorkspaceOwner31', 'u', ['userId']],
      ['NativeWorkspaceOwner31', 'u', ['consumerKey', 'metadataJson']], ['NativeOperationalRegistration31', 'p', ['operationId']],
      ['NativeOperationalRegistration31', 'u', ['requestId']], ['NativeOperationalRegistration31', 'u', ['consumerKey', 'revision']],
      ['NativeOperationalRegistration31', 'f', ['previousOperationId']]].map(([tableName, kind, columns]) => ({ tableName, kind, columns,
      validated: true, deferred: false, foreignSchema: 'public', foreignTable: 'NativeOperationalRegistration31', foreignColumns: ['operationId'], onDelete: 'r', onUpdate: 'r' }));
    return { columns, constraints };
  };
  it.each(['exact', 'missing-column', 'extra-column', 'wrong-type', 'nullable-owner', 'no-insert', 'deferred', 'foreign-schema', 'delete-cascade'])
  ('actual catalog guard rejects incomplete schema or foreign constraints: %s', change => {
    const c = catalog();
    if (change === 'missing-column') c.columns.pop(); if (change === 'extra-column') c.columns.push({ ...c.columns[0], columnName: 'extra' });
    if (change === 'wrong-type') c.columns[0].type = 'integer'; if (change === 'nullable-owner') c.columns[0].notNull = false;
    if (change === 'no-insert') c.columns[0].canInsert = false; if (change === 'deferred') c.constraints[0].deferred = true;
    if (change === 'foreign-schema') c.constraints[6].foreignSchema = 'shadow'; if (change === 'delete-cascade') c.constraints[6].onDelete = 'c';
    if (change === 'exact') expect(() => requireOperationalCatalog31(c.columns, c.constraints)).not.toThrow();
    else expect(() => requireOperationalCatalog31(c.columns, c.constraints)).toThrow();
  });
});
