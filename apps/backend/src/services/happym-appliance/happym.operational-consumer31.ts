import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, Provider, Role } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { requireSyntheticNativeCredential, SyntheticBinding } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { applianceIdentity30, consumerIdentity30, ConsumerIdentity30, NativeConsumerAdmission30Service, workspace30 } from './happym.native-consumer-admission30';
import { claimOwner31, lockOwners31, metadataHash31, ownerKey31, ownerMetadata31 } from './happym.workspace-owner31';

export type OperationalScope31 = Readonly<{ packagePharmacyKey: string; tenantId: string; pharmacyId: string }>;
export type OperationalRegistration31 = Readonly<{
  contract: 'happym.postiz-operational-registration31/v1'; operationId: string; requestId: string;
  inputSha256: string; previousOperationId: string | null; revision: number; notAfterUtc: string;
  applianceBinding: SyntheticBinding; consumerBinding: ConsumerIdentity30;
  administrator: { organizationId: string; userId: string };
  scopes: ReadonlyArray<OperationalScope31 & { organizationId: string; userId: string }>;
}>;
const object31 = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value
  && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const hash31 = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const scopeId31 = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(v);
const same31 = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const operationalId31 = (appliance: SyntheticBinding, consumer: ConsumerIdentity30, requestId: string, inputSha256: string) =>
  metadataHash31(['happym.postiz-operational-registration31/v1', appliance.clientId, appliance.applicationEnvironmentId, appliance.logicalDeploymentId, appliance.installationId, consumer.clientId, consumer.applicationEnvironmentId, consumer.logicalDeploymentId, consumer.serviceId, requestId, inputSha256]);

/** Actual SYSTEM administration is checked AGAIN INSIDE EACH mutating Tx.
 * Diagnostic M2M/purpose, a caller flag, a scope hash or a previous GET is never
 * this authority. The service binds this administrator decision to the exact
 * consumer and finite scope set in the immutable registration transaction. */
export async function requireAdministrator31(tx: Prisma.TransactionClient, systemKey: unknown,
  suppliedOrganization: unknown, systemOrganization: string, adminEmail: string) {
  const deny = (): never => { throw new ForbiddenException({ code: 'operational31_administrator_required' }); };
  if (suppliedOrganization !== systemOrganization || typeof systemKey !== 'string'
    || !/^[!-~]{32,4096}$/.test(systemKey) || !adminEmail
    || systemKey === process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET
    || systemKey === process.env.HAPPYM_EMBED_CLIENT_SECRET || systemKey === process.env.HAPPYM_TEST_FIXTURE_NATIVE_SECRET) deny();
  const system = await tx.organization.findUnique({ where: { id: systemOrganization }, select: { id: true, apiKey: true,
    users: { where: { user: { email: adminEmail, providerName: Provider.LOCAL, activated: true } },
      select: { role: true, disabled: true, user: { select: { id: true } } } } } });
  if (!system?.apiKey || system.users.length !== 1 || system.users[0].disabled
    || (system.users[0].role !== Role.ADMIN && system.users[0].role !== Role.SUPERADMIN)) deny();
  const left = Buffer.from(systemKey as string), right = Buffer.from(system!.apiKey!);
  try { if (left.length !== right.length || !timingSafeEqual(left, right)) deny(); }
  finally { left.fill(0); right.fill(0); }
  return { organizationId: systemOrganization, userId: system!.users[0].user.id };
}

/** Versioned generic installer entry. No manual SQL grant, no Root identity,
 * hardcoded customer IDs or entitlement from diagnostic admission30. */
export class NativeOperationalConsumer31Service {
  constructor(private readonly prisma: PrismaService, private readonly systemOrganization: string,
    private readonly adminEmail: string) {}

  async inspectRegistration(operationId: unknown, purpose: unknown, key: unknown, org: unknown, bindingHeader: unknown) {
    requireSyntheticNativeCredential(purpose);
    if (!hash31(operationId) || typeof bindingHeader !== 'string' || bindingHeader.length > 2048)
      throw new BadRequestException({ code: 'operational31_status_binding_invalid' });
    let binding: unknown;
    try {
      const bytes = Buffer.from(bindingHeader, 'base64');
      if (bytes.toString('base64') !== bindingHeader) throw new Error();
      binding = JSON.parse(bytes.toString('utf8'));
    } catch { throw new BadRequestException({ code: 'operational31_status_binding_invalid' }); }
    if (!object31(binding, ['applianceBinding', 'consumerBinding', 'requestId', 'inputSha256'])
      || typeof binding.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(binding.requestId) || !hash31(binding.inputSha256))
      throw new BadRequestException({ code: 'operational31_status_binding_invalid' });
    const a = applianceIdentity30(binding.applianceBinding), c = consumerIdentity30(binding.consumerBinding);
    if (operationalId31(a, c, binding.requestId, binding.inputSha256) !== operationId)
      throw new ForbiddenException({ code: 'operational31_status_foreign' });
    const requestId = binding.requestId, inputSha256 = binding.inputSha256;
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await requireAdministrator31(tx, key, org, this.systemOrganization, this.adminEmail);
      const row = await tx.nativeOperationalRegistration31.findUnique({ where: { operationId }, select: { operationId: true } });
      if (row) {
        const actual = await this.read(operationId, tx);
        if (!same31(actual.applianceBinding, a) || !same31(actual.consumerBinding, c)
          || actual.requestId !== requestId || actual.inputSha256 !== inputSha256)
          throw new ForbiddenException({ code: 'operational31_status_foreign' });
      }
      requireSyntheticNativeCredential(purpose); applianceIdentity30(a);
      return { contract: 'happym.postiz-operational-registration-state31/v1' as const, operationId,
        state: row ? 'Present' as const : 'Absent' as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: 5000 });
  }

  async register(input: unknown, purpose: unknown, key: unknown, org: unknown): Promise<OperationalRegistration31> {
    requireSyntheticNativeCredential(purpose);
    if (!object31(input, ['contract', 'applianceBinding', 'consumerBinding', 'requestId', 'inputSha256', 'previousOperationId', 'notAfterUtc', 'scopes'])
      || input.contract !== 'happym.postiz-operational-register31/v1' || typeof input.requestId !== 'string'
      || !/^[a-f0-9]{32}$/.test(input.requestId) || !hash31(input.inputSha256)
      || !(input.previousOperationId === null || hash31(input.previousOperationId))
      || typeof input.notAfterUtc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.notAfterUtc)
      || !Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 100)
      throw new BadRequestException({ code: 'operational31_registration_invalid' });
    const appliance = applianceIdentity30(input.applianceBinding), consumer = consumerIdentity30(input.consumerBinding);
    const scopes = this.scopes(input.scopes, consumer), consumerKey = ownerKey31(appliance, consumer);
    const requestId = input.requestId, inputSha256 = input.inputSha256;
    const previousOperationId = input.previousOperationId as string | null, notAfterUtc = input.notAfterUtc;
    const operationId = operationalId31(appliance, consumer, requestId, inputSha256);
    const current = () => { requireSyntheticNativeCredential(purpose); applianceIdentity30(appliance); };
    const expires = () => { const remaining = Date.parse(notAfterUtc) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 15 * 60_000)
        throw new ForbiddenException({ code: 'operational31_authorization_expired' }); };
    current(); expires();
    try {
      await this.prisma.$transaction(async tx => {
        current(); expires();
        const administrator = await requireAdministrator31(tx, key, org, this.systemOrganization, this.adminEmail);
        await lockOwners31(tx, consumerKey, scopes.map(x => x.organizationId)); current(); expires();
        // No mutation retry, exact-match POST replay or duplicate request id.
        if (await tx.nativeOperationalRegistration31.findUnique({ where: { requestId } }))
          throw new ConflictException({ code: 'operational31_request_already_registered' });
        const prior = await tx.nativeOperationalRegistration31.findFirst({ where: { consumerKey }, orderBy: { revision: 'desc' } });
        if ((prior?.operationId ?? null) !== previousOperationId)
          throw new ConflictException({ code: 'operational31_revision_conflict' });
        if (prior) {
          const old = await this.read(prior.operationId, tx);
          if (old.scopes.some(x => !scopes.some(y => same31(x, y))))
            throw new ConflictException({ code: 'operational31_scope_removal_not_supported' });
        }
        const diagnostics = new NativeConsumerAdmission30Service(this.prisma);
        for (const scope of scopes) {
          await claimOwner31(tx, appliance, consumer, scope, async () => {
            const old = await tx.nativeConsumerScopeAdmission30.findUnique({ where: { organizationId: scope.organizationId } });
            if (!old) return false;
            const receipt = await diagnostics.read(old.admissionId, tx);
            if (!same31(receipt.applianceBinding, appliance) || !same31(receipt.consumerBinding, consumer)
              || !receipt.scopes.some(row => row.tenantId === scope.tenantId && row.pharmacyId === scope.pharmacyId
                && row.organizationId === scope.organizationId && row.userId === scope.userId))
              throw new ConflictException({ code: 'operational31_diagnostic_owner_conflict' });
            return true;
          }, true);
          current(); expires();
        }
        // Re-evaluate the actual administrative principal after awaited reads,
        // before publication. Same Tx snapshot/serializable write conflicts hold.
        const after = await requireAdministrator31(tx, key, org, this.systemOrganization, this.adminEmail);
        if (!same31(administrator, after)) throw new ForbiddenException();
        const receipt: OperationalRegistration31 = { contract: 'happym.postiz-operational-registration31/v1',
          operationId, requestId, inputSha256, previousOperationId, revision: (prior?.revision ?? 0) + 1,
          notAfterUtc, applianceBinding: appliance, consumerBinding: consumer, administrator, scopes };
        await tx.nativeOperationalRegistration31.create({ data: { operationId, requestId, consumerKey,
          revision: receipt.revision, previousOperationId, receiptJson: JSON.stringify(receipt) } });
        current(); expires();
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 1000, timeout: 10000 });
      current(); return await this.read(operationId);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException({ code: 'operational31_registration_outcome_unknown' });
    }
  }

  private scopes(input: unknown[], consumer: ConsumerIdentity30) {
    const keys = new Set<string>(), ids = new Set<string>();
    return input.map(value => {
      if (!object31(value, ['packagePharmacyKey', 'tenantId', 'pharmacyId'])
        || typeof value.packagePharmacyKey !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,49}$/.test(value.packagePharmacyKey)
        || !scopeId31(value.tenantId) || !scopeId31(value.pharmacyId)
        || keys.has(value.packagePharmacyKey) || ids.has(value.pharmacyId))
        throw new BadRequestException({ code: 'operational31_scope_invalid' });
      keys.add(value.packagePharmacyKey); ids.add(value.pharmacyId);
      return { packagePharmacyKey: value.packagePharmacyKey, ...workspace30(consumer, { tenantId: value.tenantId, pharmacyId: value.pharmacyId }) };
    }).sort((a, b) => a.packagePharmacyKey < b.packagePharmacyKey ? -1 : a.packagePharmacyKey > b.packagePharmacyKey ? 1 : 0);
  }

  async read(operationId: unknown, transaction?: Prisma.TransactionClient): Promise<OperationalRegistration31> {
    if (!hash31(operationId)) throw new BadRequestException({ code: 'operational31_id_invalid' });
    const db = transaction ?? this.prisma;
    const row = await db.nativeOperationalRegistration31.findUnique({ where: { operationId } });
    if (!row || row.receiptJson.length > 49152) throw new ForbiddenException({ code: 'operational31_not_registered' });
    let r: OperationalRegistration31;
    try { r = JSON.parse(row.receiptJson); } catch { throw new ForbiddenException({ code: 'operational31_record_invalid' }); }
    if (!object31(r, ['contract', 'operationId', 'requestId', 'inputSha256', 'previousOperationId', 'revision', 'notAfterUtc',
      'applianceBinding', 'consumerBinding', 'administrator', 'scopes']) || r.contract !== 'happym.postiz-operational-registration31/v1'
      || r.operationId !== operationId || r.requestId !== row.requestId || r.revision !== row.revision
      || r.previousOperationId !== row.previousOperationId || !hash31(r.inputSha256)
      || !/^[a-f0-9]{32}$/.test(r.requestId) || !Number.isSafeInteger(r.revision) || r.revision < 1
      || !(r.previousOperationId === null || hash31(r.previousOperationId))
      || r.previousOperationId === null && r.revision !== 1
      || typeof r.notAfterUtc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.notAfterUtc)
      || !Number.isFinite(Date.parse(r.notAfterUtc)) || new Date(r.notAfterUtc).toISOString() !== r.notAfterUtc
      || !object31(r.administrator, ['organizationId', 'userId']) || r.administrator.organizationId !== this.systemOrganization
      || !scopeId31(r.administrator.userId) || !Array.isArray(r.scopes) || r.scopes.length < 1 || r.scopes.length > 100)
      throw new ForbiddenException({ code: 'operational31_record_invalid' });
    const a = applianceIdentity30(r.applianceBinding), c = consumerIdentity30(r.consumerBinding);
    const scopes = this.scopes(r.scopes.map(x => ({ packagePharmacyKey: x.packagePharmacyKey, tenantId: x.tenantId, pharmacyId: x.pharmacyId })), c);
    if (!same31(scopes, r.scopes) || ownerKey31(a, c) !== row.consumerKey
      || operationalId31(a, c, r.requestId, r.inputSha256) !== operationId)
      throw new ForbiddenException({ code: 'operational31_record_invalid' });
    for (const scope of scopes) {
      const owner = await db.nativeWorkspaceOwner31.findUnique({ where: { organizationId: scope.organizationId } });
      if (!owner || owner.userId !== scope.userId || owner.consumerKey !== row.consumerKey
        || owner.metadataJson !== ownerMetadata31(a, c, scope)) throw new ForbiddenException({ code: 'operational31_owner_changed' });
    }
    return r;
  }

  async requireScope(operationId: unknown, appliance: unknown, consumer: unknown, scope: unknown,
    purpose: unknown, key: unknown, org: unknown, tx: Prisma.TransactionClient, requireUnexpired: boolean) {
    requireSyntheticNativeCredential(purpose);
    const principal = await requireAdministrator31(tx, key, org, this.systemOrganization, this.adminEmail);
    const r = await this.read(operationId, tx), a = applianceIdentity30(appliance), c = consumerIdentity30(consumer);
    if (!same31(r.applianceBinding, a) || !same31(r.consumerBinding, c) || r.administrator.organizationId !== principal.organizationId
      || !object31(scope, ['deploymentId', 'environment', 'tenantId', 'pharmacyId'])
      || scope.environment !== 'test' || scope.deploymentId !== c.logicalDeploymentId
      || !r.scopes.some(x => x.tenantId === scope.tenantId && x.pharmacyId === scope.pharmacyId)
      || requireUnexpired && Date.parse(r.notAfterUtc) <= Date.now())
      throw new ForbiddenException({ code: 'operational31_scope_not_authorized' });
    return r;
  }
}
