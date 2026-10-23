import { ForbiddenException } from '@nestjs/common';
import { NativeConsumerAdmission30Service, admissionId30, requireAdmissionCatalog30 } from './happym.native-consumer-admission30';
import { syntheticBinding, syntheticIntegrationId } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { HappyMApplianceMiddleware } from './happym.appliance.middleware';

// Business-code tests with an in-memory transaction adapter. They prove neither
// a PostgreSQL transaction nor native/image/runtime qualification.
describe('shared appliance consumer admission30', () => {
  const original = { ...process.env };
  const purpose = 'p'.repeat(48);
  let records: Map<string, any>;
  let service: NativeConsumerAdmission30Service;
  beforeEach(() => {
    process.env.HAPPYM_APPLIANCE_MODE = 'true';
    process.env.HAPPYM_TEST_FIXTURE_ENABLED = 'true';
    process.env.HAPPYM_PUBLISHING_SAFETY_MODE = 'test-deny-external';
    process.env.HAPPYM_APPLIANCE_ENVIRONMENT_KIND = 'TEST';
    process.env.HAPPYM_APPLIANCE_CLIENT_ID = 'appliance-owner';
    process.env.HAPPYM_APPLIANCE_APPLICATION_ENVIRONMENT_ID = 'appliance-test';
    process.env.HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID = 'appliance-shared';
    process.env.HAPPYM_APPLIANCE_INSTALLATION_ID = 'appliance-install';
    process.env.HAPPYM_TEST_FIXTURE_NATIVE_SECRET = purpose;
    process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID = 'control';
    process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET = 'c'.repeat(48);
    process.env.HAPPYM_EMBED_CLIENT_SECRET = 'e'.repeat(48);
    records = new Map();
    const db: any = {
      nativeConsumerAdmission30: {
        findUnique: async ({ where }: any) => records.get(where.admissionId) ?? null,
        create: async ({ data }: any) => {
          if (records.has(data.admissionId)) throw new Error('unique');
          const scopes = data.scopes.create;
          for (const old of records.values()) for (const scope of scopes)
            if (old.scopes.some((row: any) => row.organizationId === scope.organizationId || row.userId === scope.userId)) throw new Error('scope_unique');
          const row = { ...data, scopes }; records.set(data.admissionId, row); return row;
        },
      },
      organization: { findUnique: async () => null }, user: { findUnique: async () => null },
    };
    db.$transaction = async (body: any) => {
      const before = structuredClone(records);
      try { return await body(db); } catch (error) { records = before; throw error; }
    };
    service = new NativeConsumerAdmission30Service(db);
  });
  afterEach(() => { process.env = { ...original }; });
  const consumer = (id: string) => ({ clientId: id, applicationEnvironmentId: 'qa', logicalDeploymentId: 'deployment-' + id, serviceId: 'crm' });
  const input = (id: string) => ({ contract: 'happym.native-consumer-enroll/v1', applianceBinding: syntheticBinding(), consumerBinding: consumer(id),
    requestId: (id === 'a' ? 'a' : 'b').repeat(32), requireExisting: false,
    scopes: [{ tenantId: 'group', pharmacyId: 'pharmacy' }] });
  const scope = (id: string) => ({ deploymentId: consumer(id).logicalDeploymentId, environment: 'test', tenantId: 'group', pharmacyId: 'pharmacy' });

  it('admits two distinct CRM identities on the same unchanged appliance and persists isolated workspace claims', async () => {
    const appliance = syntheticBinding();
    const a = await service.enroll(input('a'), purpose), b = await service.enroll(input('b'), purpose);
    expect(a.admissionId).not.toEqual(b.admissionId);
    expect(a.scopes[0].organizationId).not.toEqual(b.scopes[0].organizationId);
    expect(a.scopes[0].userId).not.toEqual(b.scopes[0].userId);
    expect(a.applianceBinding).toEqual(b.applianceBinding); expect(syntheticBinding()).toEqual(appliance);
    expect(await service.read(a.admissionId)).toEqual(a); expect(await service.read(b.admissionId)).toEqual(b);
    await expect(service.requireScope(a.admissionId, appliance, consumer('a'), scope('a'))).resolves.toEqual(a);
    await expect(service.requireScope(b.admissionId, appliance, consumer('b'), scope('b'))).resolves.toEqual(b);
    expect(records.size).toBe(2);
  });
  it('rejects an unregistered consumer before issuing any workspace/key', async () => {
    const a = await service.enroll(input('a'), purpose);
    await expect(service.requireScope(a.admissionId, syntheticBinding(), consumer('foreign'), scope('foreign'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.read(admissionId30(syntheticBinding(), consumer('foreign')))).rejects.toBeInstanceOf(ForbiddenException);
    expect(records.size).toBe(1);
  });
  it('isolates distinct clients even when deployment, environment, tenant and pharmacy names coincide', async () => {
    const aRequest = input('a'), bRequest = input('b');
    aRequest.consumerBinding.logicalDeploymentId = 'same-deployment';
    bRequest.consumerBinding.logicalDeploymentId = 'same-deployment';
    const a = await service.enroll(aRequest, purpose), b = await service.enroll(bRequest, purpose);
    expect(a.scopes[0].organizationId).not.toEqual(b.scopes[0].organizationId);
    expect(a.scopes[0].userId).not.toEqual(b.scopes[0].userId);
    await expect(service.requireScope(a.admissionId, a.applianceBinding, b.consumerBinding,
      { ...scope('b'), deploymentId: 'same-deployment' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects a foreign pharmacy or tenant even with a valid admission id', async () => {
    const a = await service.enroll(input('a'), purpose);
    for (const change of [{ pharmacyId: 'foreign' }, { tenantId: 'foreign' }])
      await expect(service.requireScope(a.admissionId, syntheticBinding(), consumer('a'), { ...scope('a'), ...change })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not turn an arbitrary DTO/request echo into an admission', async () => {
    const a = input('a');
    await expect(service.requireScope(admissionId30(a.applianceBinding, a.consumerBinding), a.applianceBinding, a.consumerBinding, scope('a')))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(records.size).toBe(0);
  });
  it('requires the distinct native purpose before the first enrollment write', async () => {
    await expect(service.enroll(input('a'), 'wrong')).rejects.toBeInstanceOf(ForbiddenException); expect(records.size).toBe(0);
  });
  it('rejects an ordinary scoped API key at the real control middleware before enrollment', () => {
    const next = jest.fn(), json = jest.fn();
    const response: any = { status: jest.fn().mockReturnThis(), json, setHeader: jest.fn() };
    const request: any = { header: (name: string) => name === 'X-HappyM-Client-Id' ? 'control' : 'Bearer ' + 'k'.repeat(48) };
    new HappyMApplianceMiddleware().use(request, response, next);
    expect(response.status).toHaveBeenCalledWith(401); expect(next).not.toHaveBeenCalled(); expect(records.size).toBe(0);
  });
  it('rejects appliance drift instead of rebinding the global tuple', async () => {
    const a = await service.enroll(input('a'), purpose);
    process.env.HAPPYM_APPLIANCE_LOGICAL_DEPLOYMENT_ID = 'changed';
    await expect(service.read(a.admissionId)).rejects.toBeInstanceOf(ForbiddenException); expect(records.size).toBe(1);
  });
  it('never silently repeats an enrollment; explicit existing-only must be exact', async () => {
    const request = input('a'), a = await service.enroll(request, purpose);
    await expect(service.enroll(request, purpose)).rejects.toBeDefined();
    await expect(service.enroll({ ...request, requireExisting: true }, purpose)).resolves.toEqual(a);
    await expect(service.enroll({ ...request, requireExisting: true, scopes: [{ tenantId: 'group', pharmacyId: 'other' }] }, purpose)).rejects.toBeDefined();
    expect(records.size).toBe(1);
  });
  it('does not repair a missing enrollment during existing-only recovery', async () => {
    await expect(service.enroll({ ...input('a'), requireExisting: true }, purpose)).rejects.toBeDefined(); expect(records.size).toBe(0);
  });
  it('rejects tampered durable scope metadata instead of accepting only the JSON body', async () => {
    const a = await service.enroll(input('a'), purpose);
    records.get(a.admissionId).scopes[0].organizationId = 'foreign';
    await expect(service.read(a.admissionId)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('preserves all four legacy fixture identifiers and uses the same appliance binding for new consumer fixtures', async () => {
    const binding = syntheticBinding();
    const profiles = ['success', 'transient-before-commit', 'lost-response-after-commit', 'partial-slide'] as const;
    const before = profiles.map(profile => syntheticIntegrationId(binding, 'legacy-org', profile));
    const a = await service.enroll(input('a'), purpose);
    expect(profiles.map(profile => syntheticIntegrationId(syntheticBinding(), 'legacy-org', profile))).toEqual(before);
    expect(profiles.map(profile => syntheticIntegrationId(binding, a.scopes[0].organizationId, profile)))
      .not.toEqual(profiles.map(profile => syntheticIntegrationId({ ...binding, clientId: 'a' }, a.scopes[0].organizationId, profile)));
  });
  const catalog = () => {
    const columns = [
      ['NativeConsumerAdmission30', 'admissionId', 'character(64)'], ['NativeConsumerAdmission30', 'requestId', 'character(32)'],
      ['NativeConsumerAdmission30', 'receiptJson', 'text'], ['NativeConsumerAdmission30', 'createdAt', 'timestamp(3) without time zone'],
      ['NativeConsumerScopeAdmission30', 'organizationId', 'text'], ['NativeConsumerScopeAdmission30', 'userId', 'text'],
      ['NativeConsumerScopeAdmission30', 'admissionId', 'character(64)'], ['NativeConsumerScopeAdmission30', 'tenantId', 'text'],
      ['NativeConsumerScopeAdmission30', 'pharmacyId', 'text'],
    ].map(([tableName, columnName, type]) => ({ tableName, columnName, type, notNull: true, canSelect: true, canInsert: true }));
    const constraints: any[] = [
      ['NativeConsumerAdmission30', 'p', ['admissionId']], ['NativeConsumerScopeAdmission30', 'p', ['organizationId']],
      ['NativeConsumerScopeAdmission30', 'u', ['userId']], ['NativeConsumerScopeAdmission30', 'u', ['admissionId', 'pharmacyId']],
      ['NativeConsumerScopeAdmission30', 'f', ['admissionId']],
    ].map(([tableName, kind, columns]) => ({ tableName, kind, columns, validated: true, deferred: false }));
    Object.assign(constraints[4], { foreignTable: 'NativeConsumerAdmission30', foreignSchema: 'public', foreignColumns: ['admissionId'], onDelete: 'r', onUpdate: 'r' });
    return { columns, constraints };
  };
  it('requires the actual admission catalog/constraints before CRM credential import can proceed', () => {
    const schema = catalog(); expect(() => requireAdmissionCatalog30(schema.columns, schema.constraints)).not.toThrow();
    schema.constraints.pop(); expect(() => requireAdmissionCatalog30(schema.columns, schema.constraints)).toThrow();
  });
  it('denies a missing real INSERT privilege instead of trusting a schema-ready declaration', () => {
    const schema = catalog(); schema.columns[0].canInsert = false;
    expect(() => requireAdmissionCatalog30(schema.columns, schema.constraints)).toThrow();
  });
});
