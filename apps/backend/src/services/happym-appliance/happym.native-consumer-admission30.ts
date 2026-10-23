import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { claimOwner31, lockOwners31, ownerKey31 } from './happym.workspace-owner31';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { requireSyntheticNativeCredential, syntheticBinding, SyntheticBinding } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';

export type ConsumerIdentity30 = Readonly<{ clientId: string; applicationEnvironmentId: string; logicalDeploymentId: string; serviceId: string }>;
export type ConsumerScope30 = Readonly<{ tenantId: string; pharmacyId: string }>;
export type ConsumerAdmission30 = Readonly<{
  contract: 'happym.native-consumer-admission/v1'; admissionId: string; requestId: string;
  applianceBinding: SyntheticBinding; consumerBinding: ConsumerIdentity30;
  scopes: ReadonlyArray<ConsumerScope30 & { organizationId: string; userId: string }>;
}>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const object = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
const scopeToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(value);
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function consumerIdentity30(value: unknown): ConsumerIdentity30 {
  if (!object(value, ['clientId', 'applicationEnvironmentId', 'logicalDeploymentId', 'serviceId'])
    || !Object.values(value).every(token) || typeof value.logicalDeploymentId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.logicalDeploymentId)) throw new BadRequestException({ code: 'consumer30_identity_invalid' });
  return { clientId: value.clientId as string, applicationEnvironmentId: value.applicationEnvironmentId as string,
    logicalDeploymentId: value.logicalDeploymentId as string, serviceId: value.serviceId as string };
}
export function applianceIdentity30(value: unknown): SyntheticBinding {
  const actual = syntheticBinding();
  if (!object(value, ['clientId', 'applicationEnvironmentId', 'logicalDeploymentId', 'installationId'])
    || Object.entries(actual).some(([key, expected]) => value[key] !== expected))
    throw new ForbiddenException({ code: 'consumer30_appliance_mismatch' });
  return actual;
}
export function admissionId30(appliance: SyntheticBinding, consumer: ConsumerIdentity30): string {
  return hash(['happym.native-consumer-admission/v1', appliance.clientId, appliance.applicationEnvironmentId,
    appliance.logicalDeploymentId, appliance.installationId, consumer.clientId, consumer.applicationEnvironmentId,
    consumer.logicalDeploymentId, consumer.serviceId]);
}
export function workspace30(consumer: ConsumerIdentity30, scope: ConsumerScope30) {
  const digest = hash(['happym.postiz.consumer-workspace/v2', consumer.clientId, consumer.applicationEnvironmentId,
    consumer.logicalDeploymentId, consumer.serviceId, 'test', scope.tenantId, scope.pharmacyId]);
  return { ...scope, organizationId: 'hm-' + digest, userId: 'sm.' + digest };
}

/** Exact live catalog projection, not a caller-supplied schema/ready flag. */
export function requireAdmissionCatalog30(columns: any[], constraints: any[]): void {
  const expected: Record<string, string> = {
    'NativeConsumerAdmission30.admissionId': 'character(64)', 'NativeConsumerAdmission30.requestId': 'character(32)',
    'NativeConsumerAdmission30.receiptJson': 'text', 'NativeConsumerAdmission30.createdAt': 'timestamp(3) without time zone',
    'NativeConsumerScopeAdmission30.organizationId': 'text', 'NativeConsumerScopeAdmission30.userId': 'text',
    'NativeConsumerScopeAdmission30.admissionId': 'character(64)', 'NativeConsumerScopeAdmission30.tenantId': 'text',
    'NativeConsumerScopeAdmission30.pharmacyId': 'text',
  };
  const seen = new Set<string>();
  const fail = (): never => { throw new ServiceUnavailableException({ code: 'consumer30_schema_not_qualified' }); };
  if (!Array.isArray(columns) || columns.length !== 9 || !Array.isArray(constraints) || constraints.length !== 5) fail();
  for (const row of columns) {
    const key = row.tableName + '.' + row.columnName;
    if (seen.has(key) || expected[key] !== row.type || row.notNull !== true || row.canSelect !== true || row.canInsert !== true) fail();
    seen.add(key);
  }
  const wanted = new Set([
    'NativeConsumerAdmission30:p:admissionId', 'NativeConsumerScopeAdmission30:p:organizationId',
    'NativeConsumerScopeAdmission30:u:userId', 'NativeConsumerScopeAdmission30:u:admissionId,pharmacyId',
    'NativeConsumerScopeAdmission30:f:admissionId',
  ]);
  for (const row of constraints) {
    const key = row.tableName + ':' + row.kind + ':' + (Array.isArray(row.columns) ? row.columns.join(',') : '?');
    if (!wanted.delete(key) || row.validated !== true || row.deferred !== false) fail();
    if (row.kind === 'f' && (row.foreignTable !== 'NativeConsumerAdmission30' || row.foreignSchema !== 'public'
      || !Array.isArray(row.foreignColumns) || row.foreignColumns.join(',') !== 'admissionId'
      || row.onDelete !== 'r' || row.onUpdate !== 'r')) fail();
  }
  if (wanted.size !== 0) fail();
}

/** Native enrollment is authoritative server state, not a request echo. No key is
 * stored in this metadata table. No endpoint updates, rebinds or deletes a row. */
export class NativeConsumerAdmission30Service {
  constructor(private readonly prisma: PrismaService) {}

  async enroll(input: unknown, credential: unknown): Promise<ConsumerAdmission30> {
    requireSyntheticNativeCredential(credential);
    if (!object(input, ['contract', 'applianceBinding', 'consumerBinding', 'requestId', 'requireExisting', 'scopes'])
      || input.contract !== 'happym.native-consumer-enroll/v1' || typeof input.requestId !== 'string'
      || !/^[a-f0-9]{32}$/.test(input.requestId) || typeof input.requireExisting !== 'boolean'
      || !Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 2)
      throw new BadRequestException({ code: 'consumer30_enrollment_invalid' });
    const applianceBinding = applianceIdentity30(input.applianceBinding), consumerBinding = consumerIdentity30(input.consumerBinding);
    const seen = new Set<string>();
    const scopes = input.scopes.map(value => {
      if (!object(value, ['tenantId', 'pharmacyId']) || !scopeToken(value.tenantId) || !scopeToken(value.pharmacyId)
        || seen.has(value.pharmacyId)) throw new BadRequestException({ code: 'consumer30_scope_invalid' });
      seen.add(value.pharmacyId);
      return workspace30(consumerBinding, { tenantId: value.tenantId, pharmacyId: value.pharmacyId });
    }).sort((a, b) => a.pharmacyId < b.pharmacyId ? -1 : a.pharmacyId > b.pharmacyId ? 1 : 0);
    const admissionId = admissionId30(applianceBinding, consumerBinding), requestId = input.requestId;
    const receipt: ConsumerAdmission30 = { contract: 'happym.native-consumer-admission/v1', admissionId, requestId,
      applianceBinding, consumerBinding, scopes };
    const current = () => { applianceIdentity30(applianceBinding); requireSyntheticNativeCredential(credential); };
    current();
    try {
      await this.prisma.$transaction(async tx => {
        current();
        await lockOwners31(tx, ownerKey31(applianceBinding, consumerBinding), scopes.map(x => x.organizationId));
        current();
        const old = await tx.nativeConsumerAdmission30.findUnique({ where: { admissionId } });
        if (old) {
          if (!input.requireExisting || old.requestId !== requestId || old.receiptJson !== JSON.stringify(receipt))
            throw new ConflictException({ code: 'consumer30_enrollment_conflict' });
          for (const scope of scopes) await claimOwner31(tx, applianceBinding, consumerBinding, scope, async () => false, false);
          current(); return;
        }
        if (input.requireExisting) throw new ConflictException({ code: 'consumer30_enrollment_missing' });
        for (const scope of scopes) {
          await claimOwner31(tx, applianceBinding, consumerBinding, scope, async () => false, true);
          current();
        }
        await tx.nativeConsumerAdmission30.create({ data: { admissionId, requestId, receiptJson: JSON.stringify(receipt),
          scopes: { create: scopes.map(scope => ({ ...scope })) } } });
        current();
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 1000, timeout: 5000 });
      current();
      const observed = await this.read(admissionId);
      if (!same(observed, receipt)) throw new Error('readback');
      return observed;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // Includes uncertain transaction/readback: never retry, upsert or disclose
      // database errors. The native owner preserves its attempt/UNKNOWN evidence.
      throw new ServiceUnavailableException({ code: 'consumer30_enrollment_outcome_unknown' });
    }
  }

  async read(admissionId: unknown, transaction?: Prisma.TransactionClient): Promise<ConsumerAdmission30> {
    if (typeof admissionId !== 'string' || !/^[a-f0-9]{64}$/.test(admissionId))
      throw new BadRequestException({ code: 'consumer30_admission_invalid' });
    const db = transaction ?? this.prisma;
    const row = await db.nativeConsumerAdmission30.findUnique({ where: { admissionId }, include: { scopes: true } });
    if (!row) throw new ForbiddenException({ code: 'consumer30_not_enrolled' });
    if (row.receiptJson.length > 8192) throw new ForbiddenException({ code: 'consumer30_record_invalid' });
    let receipt: ConsumerAdmission30;
    try { receipt = JSON.parse(row.receiptJson); } catch { throw new ForbiddenException({ code: 'consumer30_record_invalid' }); }
    if (!object(receipt, ['contract', 'admissionId', 'requestId', 'applianceBinding', 'consumerBinding', 'scopes'])
      || receipt.contract !== 'happym.native-consumer-admission/v1' || receipt.admissionId !== admissionId
      || receipt.requestId !== row.requestId || !/^[a-f0-9]{32}$/.test(receipt.requestId))
      throw new ForbiddenException({ code: 'consumer30_record_invalid' });
    const appliance = applianceIdentity30(receipt.applianceBinding), consumer = consumerIdentity30(receipt.consumerBinding);
    if (admissionId30(appliance, consumer) !== admissionId || !Array.isArray(receipt.scopes)
      || receipt.scopes.length < 1 || receipt.scopes.length > 2 || row.scopes.length !== receipt.scopes.length)
      throw new ForbiddenException({ code: 'consumer30_record_invalid' });
    const seen = new Set<string>();
    for (const scope of receipt.scopes) {
      if (!object(scope, ['tenantId', 'pharmacyId', 'organizationId', 'userId']) || !scopeToken(scope.tenantId)
        || !scopeToken(scope.pharmacyId) || seen.has(scope.pharmacyId)
        || !same(workspace30(consumer, { tenantId: scope.tenantId, pharmacyId: scope.pharmacyId }), scope)
        || !row.scopes.some(actual => actual.tenantId === scope.tenantId && actual.pharmacyId === scope.pharmacyId
          && actual.organizationId === scope.organizationId && actual.userId === scope.userId))
        throw new ForbiddenException({ code: 'consumer30_record_invalid' });
      seen.add(scope.pharmacyId);
    }
    return receipt;
  }

  async requireScope(admissionId: unknown, appliance: unknown, consumer: unknown, scope: unknown,
    transaction?: Prisma.TransactionClient) {
    const expectedAppliance = applianceIdentity30(appliance), expectedConsumer = consumerIdentity30(consumer);
    const receipt = await this.read(admissionId, transaction);
    if (!same(receipt.applianceBinding, expectedAppliance) || !same(receipt.consumerBinding, expectedConsumer)
      || !object(scope, ['deploymentId', 'environment', 'tenantId', 'pharmacyId']) || scope.environment !== 'test'
      || scope.deploymentId !== expectedConsumer.logicalDeploymentId
      || !receipt.scopes.some(row => row.tenantId === scope.tenantId && row.pharmacyId === scope.pharmacyId))
      throw new ForbiddenException({ code: 'consumer30_scope_not_admitted' });
    return receipt;
  }
}
