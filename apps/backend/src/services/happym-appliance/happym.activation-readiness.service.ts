import { timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { requireSyntheticNativeCredential, syntheticBinding } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';
import { NativeConsumerAdmission30Service, requireAdmissionCatalog30 } from './happym.native-consumer-admission30';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { publishingSafetySnapshot, HappyMPublishingSafetySnapshot, applianceBindingSnapshot,
  HappyMApplianceBinding, declaredIdentifier } from '@gitroom/nestjs-libraries/happym-appliance/happym.publishing-safety';
import {
  ACTIVATION_CATALOG_SQL, ACTIVATION_LEDGER_SQL, ActivationSchemaStatus,
  canReadActivationLedger, evaluateActivationSchema, notQualified, validProbeNonce,
} from './happym.activation-schema';

export type HappyMActivationReadiness = {
  contract: 'happym.appliance.activation-readiness/v1';
  nonce: string;
  observedAtUtc: string;
  status: 'NotQualified';
  binding: HappyMApplianceBinding;
  controlClientId: string | null;
  codes: string[];
  schema: ActivationSchemaStatus;
  sender: HappyMPublishingSafetySnapshot & { guardedEntryPoints: string[] };
  externalEvidence: { image: 'NotObserved'; egress: 'NotObserved' };
};

@Injectable()
export class HappyMActivationReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async observeCapabilities30(nonce: unknown, purpose: unknown, embed: unknown, systemKey: unknown, systemOrganization: unknown) {
    if (!validProbeNonce(nonce)) throw new BadRequestException({ code: 'activation_probe_nonce_invalid' });
    requireSyntheticNativeCredential(purpose);
    const appliance = syntheticBinding();
    const equal = (left: unknown, right: unknown): boolean => {
      if (typeof left !== 'string' || typeof right !== 'string' || left.length < 1 || left.length > 4096) return false;
      const a = Buffer.from(left), b = Buffer.from(right);
      try { return a.length === b.length && timingSafeEqual(a, b); } finally { a.fill(0); b.fill(0); }
    };
    const org = process.env.HAPPYM_APPLIANCE_SYSTEM_ORGANIZATION_ID || 'happym-system';
    if (!equal(embed, process.env.HAPPYM_EMBED_CLIENT_SECRET) || systemOrganization !== org
      || typeof systemKey !== 'string' || systemKey === purpose || systemKey === embed
      || systemKey === process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET)
      throw new ForbiddenException({ code: 'consumer30_controller_credential_mismatch' });
    // A current handler and both actual metadata tables must be observable before
    // the native CRM imports any credential. This performs no enrollment/DDL.
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const columns = await tx.$queryRaw<any[]>`SELECT c.relname::text AS "tableName", a.attname::text AS "columnName",
        format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS "notNull",
        has_table_privilege(current_user,c.oid,'SELECT') AS "canSelect", has_table_privilege(current_user,c.oid,'INSERT') AS "canInsert"
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
        WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('NativeConsumerAdmission30','NativeConsumerScopeAdmission30')
        AND a.attnum>0 AND NOT a.attisdropped`;
      const constraints = await tx.$queryRaw<any[]>`SELECT c.relname::text AS "tableName", k.contype::text AS kind,
        ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY x(num,ord)
          JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=x.num ORDER BY x.ord) AS "columns",
        k.convalidated AS validated, k.condeferrable AS deferred, fc.relname::text AS "foreignTable", fn.nspname::text AS "foreignSchema",
        ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY x(num,ord)
          JOIN pg_catalog.pg_attribute a ON a.attrelid=fc.oid AND a.attnum=x.num ORDER BY x.ord) AS "foreignColumns",
        k.confdeltype::text AS "onDelete", k.confupdtype::text AS "onUpdate"
        FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_class fc ON fc.oid=k.confrelid
        LEFT JOIN pg_catalog.pg_namespace fn ON fn.oid=fc.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('NativeConsumerAdmission30','NativeConsumerScopeAdmission30')`;
      requireAdmissionCatalog30(columns, constraints);
      await tx.nativeConsumerAdmission30.count();
      await tx.nativeConsumerScopeAdmission30.count();
      const system = await tx.organization.findUnique({ where: { id: org }, select: { apiKey: true } });
      if (!system || !equal(systemKey, system.apiKey)) throw new ForbiddenException({ code: 'consumer30_controller_credential_mismatch' });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: 5000 });
    const readiness = await this.observe(nonce);
    requireSyntheticNativeCredential(purpose);
    if (JSON.stringify(syntheticBinding()) !== JSON.stringify(appliance)
      || JSON.stringify(readiness.binding) !== JSON.stringify(appliance))
      throw new ForbiddenException({ code: 'consumer30_appliance_changed' });
    return { contract: 'happym.appliance.consumer-capabilities/v1' as const,
      admissionSchema: 'happym.native-consumer-admission/v1' as const, readiness };
  }

  async observeConsumer30(nonce: unknown, admissionId: string) {
    if (!validProbeNonce(nonce)) throw new BadRequestException({ code: 'activation_probe_nonce_invalid' });
    const admissions = new NativeConsumerAdmission30Service(this.prisma);
    const admission = await admissions.read(admissionId);
    const readiness = await this.observe(nonce);
    const after = await admissions.read(admissionId);
    if (JSON.stringify(after) !== JSON.stringify(admission)
      || JSON.stringify(readiness.binding) !== JSON.stringify(admission.applianceBinding))
      throw new BadRequestException({ code: 'consumer30_admission_changed' });
    return { contract: 'happym.appliance.consumer-readiness/v1' as const, readiness, admission };
  }

  async observe(nonce: unknown): Promise<HappyMActivationReadiness> {
    if (!validProbeNonce(nonce)) throw new BadRequestException({ code: 'activation_probe_nonce_invalid' });
    const observedAtUtc = new Date().toISOString();
    let schema: ActivationSchemaStatus;
    try {
      schema = await this.prisma.$transaction(async tx => {
        // Connection-local transaction mode only. Never mutate an authoritative
        // row, create a ledger, call db-push/migrate or invoke appliance bootstrap.
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const catalog = await tx.$queryRaw<unknown[]>(Prisma.raw(ACTIVATION_CATALOG_SQL));
        const ledger = canReadActivationLedger(catalog)
          ? await tx.$queryRaw<unknown[]>(Prisma.raw(ACTIVATION_LEDGER_SQL)) : undefined;
        return evaluateActivationSchema(catalog, ledger);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: 5000 });
    } catch {
      schema = notQualified(['schema_observation_unavailable']);
    }
    return {
      contract: 'happym.appliance.activation-readiness/v1', nonce, observedAtUtc,
      status: 'NotQualified',
      binding: applianceBindingSnapshot(),
      controlClientId: declaredIdentifier(process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_ID),
      codes: ['isolated_test_sender_not_qualified', 'native_image_not_observed', 'native_egress_not_observed'],
      schema,
      sender: { ...publishingSafetySnapshot(), guardedEntryPoints: [
        'postSocial', 'postSocialPending', 'postComment', 'checkPostStatus', 'finalizePost',
        'globalPlugs', 'internalPlugs', 'processPlug', 'processInternalPlug', 'sendWebhooks',
        'refreshToken', 'refreshTokenWithCause', 'RefreshIntegrationService.refresh',
      ] },
      externalEvidence: { image: 'NotObserved', egress: 'NotObserved' },
    };
  }
}
