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
