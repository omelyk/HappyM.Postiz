import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Integration, Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { applianceBindingSnapshot, publishingSafetySnapshot } from '@gitroom/nestjs-libraries/happym-appliance/happym.publishing-safety';

export const SYNTHETIC_PROVIDER = 'happym-test-fixture';
const TOKEN = 'happym-test-fixture:no-oauth'; // Explicit non-credential, never sent to a provider.
export const SYNTHETIC_PROFILES = ['success', 'transient-before-commit', 'lost-response-after-commit', 'partial-slide'] as const;
export type SyntheticProfile = typeof SYNTHETIC_PROFILES[number];
export type SyntheticBinding = Readonly<{ clientId: string; applicationEnvironmentId: string; logicalDeploymentId: string; installationId: string }>;
export type SyntheticEventKind = 'Attempted' | 'TransientRejected' | 'SlideCommitted' | 'ResponseLost' | 'Completed';
export type SyntheticReadback = {
  contract: 'happym.synthetic-delivery/v1'; mode: 'SIMULATION';
  status: 'NotStarted' | 'Partial' | 'SimulatedPublished';
  organizationId: string; integrationId: string; postId: string; occurrenceId: string; bodyHash: string | null;
  slides: Array<{ slideIndex: number; syntheticReceiptId: string; status: 'SimulatedCommitted' }>;
  events: Array<{ ordinal: number; kind: SyntheticEventKind }>;
};
type Occurrence = Prisma.PrePublishRenderOccurrenceGetPayload<{ include: { post: true; integration: true } }>;
type Scope = { scopeKey: string; clientId: string; environmentId: string; deploymentId: string; installationId: string;
  organizationId: string; integrationId: string; postId: string; occurrenceId: string };
const fail = (code: string): never => { throw new ConflictException({ code }); };
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
export function syntheticIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
}
export function syntheticBinding(environment: Readonly<Record<string, string | undefined>> = process.env): SyntheticBinding {
  const safety = publishingSafetySnapshot(environment), binding = applianceBindingSnapshot(environment);
  if (environment.HAPPYM_APPLIANCE_MODE !== 'true' || environment.HAPPYM_TEST_FIXTURE_ENABLED !== 'true'
    || safety.environmentKind !== 'TEST' || safety.declaredMode !== 'test-deny-external'
    || !syntheticIdentifier(binding.clientId) || !syntheticIdentifier(binding.applicationEnvironmentId)
    || !syntheticIdentifier(binding.logicalDeploymentId) || !syntheticIdentifier(binding.installationId))
    throw new ForbiddenException({ code: 'synthetic_fixture_not_enabled' });
  return { clientId: binding.clientId, applicationEnvironmentId: binding.applicationEnvironmentId,
    logicalDeploymentId: binding.logicalDeploymentId, installationId: binding.installationId };
}
export function syntheticProfile(integration: Pick<Integration, 'providerIdentifier' | 'internalId'>): SyntheticProfile {
  const profile = integration.internalId.slice((SYNTHETIC_PROVIDER + ':').length);
  if (integration.providerIdentifier !== SYNTHETIC_PROVIDER || !integration.internalId.startsWith(SYNTHETIC_PROVIDER + ':')
    || !SYNTHETIC_PROFILES.includes(profile as SyntheticProfile)) return fail('synthetic_fixture_integration_invalid');
  return profile as SyntheticProfile;
}
export function syntheticIntegrationId(binding: SyntheticBinding, org: string, profile: SyntheticProfile): string {
  return 'happym-sim-' + hash(JSON.stringify([binding.clientId, binding.applicationEnvironmentId,
    binding.logicalDeploymentId, binding.installationId, org, profile])).slice(0, 40);
}
// Shared only by native TEST provisioning ingresses; M2M remains mandatory.
// This is not authority for PROD onboarding or for an ordinary consumer client.
export function requireSyntheticNativeCredential(actual: unknown): void {
  const expected = process.env.HAPPYM_TEST_FIXTURE_NATIVE_SECRET;
  if (typeof actual !== 'string' || actual.length < 32 || actual.length > 256
    || !expected || expected.length < 32 || expected.length > 256
    || expected === process.env.HAPPYM_APPLIANCE_INTERNAL_CLIENT_SECRET || expected === process.env.HAPPYM_EMBED_CLIENT_SECRET)
    throw new ForbiddenException({ code: 'synthetic_native_credential_required' });
  const a = Buffer.from(actual), b = Buffer.from(expected);
  try {
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new ForbiddenException({ code: 'synthetic_native_credential_required' });
  } finally { a.fill(0); b.fill(0); }
}
export class SyntheticFixtureFault extends Error {
  constructor(public readonly code: 'SyntheticTransientBeforeCommit' | 'SyntheticOutcomeUnknown') { super(code); }
}

@Injectable()
export class SyntheticFixtureService {
  constructor(private readonly prisma: PrismaService) {}

  // Existing appliance M2M is mandatory but insufficient for provisioning. The
  // additional native-purpose credential is issued/retained by qualified native
  // setup, never a browser/ordinary SDK command. Its absence leaves seed closed.
  async provision(input: unknown, nativeCredential: unknown) {
    const binding = syntheticBinding(); this.requireNativeCredential(nativeCredential);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException({ code: 'synthetic_provision_invalid' });
    const row = input as Record<string, unknown>;
    if (Object.keys(row).sort().join(',') !== 'binding,organizationId,profile'
      || !syntheticIdentifier(row.organizationId) || !SYNTHETIC_PROFILES.includes(row.profile as SyntheticProfile)
      || !row.binding || typeof row.binding !== 'object' || Array.isArray(row.binding))
      throw new BadRequestException({ code: 'synthetic_provision_invalid' });
    const expected = row.binding as Record<string, unknown>;
    if (Object.keys(expected).sort().join(',') !== Object.keys(binding).sort().join(',')
      || Object.entries(binding).some(([key, value]) => expected[key] !== value))
      throw new ForbiddenException({ code: 'synthetic_target_binding_mismatch' });
    const profile = row.profile as SyntheticProfile, org = row.organizationId;
    const id = syntheticIntegrationId(binding, org, profile);
    if (!await this.prisma.organization.findUnique({ where: { id: org }, select: { id: true } }))
      throw new NotFoundException({ code: 'synthetic_organization_missing' });
    let integration = await this.prisma.integration.findFirst({ where: { id, organizationId: org, providerIdentifier: SYNTHETIC_PROVIDER } });
    if (!integration) integration = await this.prisma.integration.create({ data: {
      id, organizationId: org, internalId: SYNTHETIC_PROVIDER + ':' + profile,
      providerIdentifier: SYNTHETIC_PROVIDER, type: 'social', token: TOKEN,
      name: '[SIMULAZIONE] ' + profile, disabled: false, refreshNeeded: false,
      additionalSettings: '[]',
    } });
    this.requireIntegration(integration, org, binding);
    this.requireSameBinding(binding);
    return { contract: 'happym.synthetic-delivery/v1' as const, mode: 'SIMULATION' as const,
      integrationId: id, identifier: SYNTHETIC_PROVIDER, label: integration.name };
  }

  requireIntegration(integration: Integration, organizationId: string, binding = syntheticBinding()): SyntheticProfile {
    const profile = syntheticProfile(integration);
    if (integration.id !== syntheticIntegrationId(binding, organizationId, profile)
      || integration.organizationId !== organizationId || integration.token !== TOKEN
      || integration.refreshToken !== null || integration.tokenExpiration !== null
      || integration.disabled || integration.deletedAt !== null || integration.refreshNeeded
      || integration.type !== 'social') return fail('synthetic_fixture_integration_invalid');
    return profile;
  }

  async readback(organizationId: string, postId: string, occurrenceId: string): Promise<SyntheticReadback> {
    const binding = syntheticBinding(); this.requireIds(organizationId, postId, occurrenceId);
    const observed = await this.prisma.$transaction(async tx => {
      const occurrence = await this.load(tx, organizationId, postId, occurrenceId);
      this.requireIntegration(occurrence.integration, organizationId, binding);
      return this.read(tx, this.scope(binding, occurrence), occurrence);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: 5000 });
    this.requireSameBinding(binding); return observed;
  }

  async deliver(organizationId: string, postId: string, occurrenceId: string): Promise<SyntheticReadback> {
    const binding = syntheticBinding(); this.requireIds(organizationId, postId, occurrenceId);
    const outcome = await this.prisma.$transaction(async tx => {
      // Real database row lock serializes attempts and event ordinals for this
      // post; unique journal keys and conditional terminal updates fence replay.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Post" WHERE "id" = ${postId} AND "organizationId" = ${organizationId} FOR UPDATE`;
      if (locked.length !== 1) return fail('synthetic_post_missing');
      const occurrence = await this.load(tx, organizationId, postId, occurrenceId);
      const profile = this.requireIntegration(occurrence.integration, organizationId, binding);
      const scope = this.scope(binding, occurrence), payload = this.payload(occurrence);
      if (profile === 'partial-slide' && payload.slideCount < 2) return fail('synthetic_partial_requires_multiple_slides');
      const previous = await this.read(tx, scope, occurrence);
      if (previous.bodyHash !== null && previous.bodyHash !== payload.bodyHash) return fail('synthetic_body_conflict');
      if (previous.status === 'SimulatedPublished') return { readback: previous, fault: null };
      if (occurrence.status !== 'READY_TO_PUBLISH' || occurrence.post.state !== 'QUEUE'
        || occurrence.post.deletedAt !== null || occurrence.post.intervalInDays !== null
        || occurrence.scheduledFor.getTime() > Date.now()) return fail('synthetic_render_or_schedule_not_ready');
      const events = previous.events; let ordinal = events.length ? events[events.length - 1].ordinal : 0;
      const attempt = events.filter(event => event.kind === 'Attempted').length + 1;
      const event = async (kind: SyntheticEventKind, slideIndex: number | null = null) => {
        if (ordinal >= 1000) return fail('synthetic_event_limit');
        await tx.syntheticDeliveryEvent.create({ data: { ...scope, ordinal: ++ordinal, bodyHash: payload.bodyHash, kind, slideIndex } });
      };
      await event('Attempted');
      if (profile === 'transient-before-commit' && attempt === 1) {
        await event('TransientRejected');
        return { readback: await this.read(tx, scope, occurrence), fault: 'SyntheticTransientBeforeCommit' as const };
      }
      const partial = profile === 'partial-slide' && attempt === 1;
      for (let slideIndex = 0; slideIndex < payload.slideCount; slideIndex++) {
        if (previous.slides.some(slide => slide.slideIndex === slideIndex)) continue;
        await tx.syntheticDeliveryReceipt.create({ data: { ...scope, slideIndex, bodyHash: payload.bodyHash,
          syntheticReceiptId: 'synthetic_' + hash(scope.scopeKey + ':' + payload.bodyHash + ':' + slideIndex) } });
        await event('SlideCommitted', slideIndex);
        if (partial) break;
      }
      const count = await tx.syntheticDeliveryReceipt.count({ where: scope });
      if (count === payload.slideCount) {
        const post = await tx.post.updateMany({ where: { id: postId, organizationId, state: 'QUEUE', deletedAt: null },
          data: { state: 'SIMULATED', releaseId: null, releaseURL: null } });
        const render = await tx.prePublishRenderOccurrence.updateMany({
          where: { id: occurrenceId, organizationId, postId, integrationId: occurrence.integrationId, status: 'READY_TO_PUBLISH' },
          data: { status: 'SIMULATED', publishedAt: null, releaseId: null, releaseUrl: null, publishReceipt: null } });
        if (post.count !== 1 || render.count !== 1) return fail('synthetic_completion_conflict');
        await event('Completed');
      }
      const lost = profile === 'lost-response-after-commit' && attempt === 1 || partial;
      if (lost) await event('ResponseLost');
      const observed = await this.load(tx, organizationId, postId, occurrenceId);
      return { readback: await this.read(tx, scope, observed), fault: lost ? 'SyntheticOutcomeUnknown' as const : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 1000, timeout: 5000 });
    this.requireSameBinding(binding); // Never accept identity drift across the commit.
    // These faults happen AFTER durable publication. No swallowed exception,
    // compensation or generic provider retry; callers must read exact scope.
    if (outcome.fault) throw new SyntheticFixtureFault(outcome.fault);
    return outcome.readback;
  }

  private async load(tx: Prisma.TransactionClient, organizationId: string, postId: string, occurrenceId: string): Promise<Occurrence> {
    const row = await tx.prePublishRenderOccurrence.findFirst({ where: { id: occurrenceId, organizationId, postId,
      integration: { is: { providerIdentifier: SYNTHETIC_PROVIDER, organizationId } } }, include: { post: true, integration: true } });
    if (!row || row.post.organizationId !== organizationId || row.post.integrationId !== row.integrationId
      || row.integration.organizationId !== organizationId) throw new NotFoundException({ code: 'synthetic_scope_missing' });
    if (row.post.releaseId !== null || row.post.releaseURL !== null || row.releaseId !== null || row.releaseUrl !== null
      || row.publishedAt !== null || row.publishReceipt !== null) return fail('synthetic_real_receipt_forbidden');
    return row;
  }
  private scope(binding: SyntheticBinding, row: Occurrence): Scope {
    const fields = { clientId: binding.clientId, environmentId: binding.applicationEnvironmentId,
      deploymentId: binding.logicalDeploymentId, installationId: binding.installationId,
      organizationId: row.organizationId, integrationId: row.integrationId, postId: row.postId, occurrenceId: row.id };
    return { scopeKey: hash(JSON.stringify(Object.values(fields))), ...fields };
  }
  private payload(row: Occurrence): { bodyHash: string; slideCount: number } {
    if (!row.contentHash || !/^sha256-[a-f0-9]{64}$/.test(row.contentHash)
      || !row.renderedPayload || Buffer.byteLength(row.renderedPayload, 'utf8') > 1024 * 1024) return fail('synthetic_payload_invalid');
    let input: unknown;
    try { input = JSON.parse(row.renderedPayload); } catch { return fail('synthetic_payload_invalid'); }
    if (!input || typeof input !== 'object' || !('targets' in input) || !Array.isArray(input.targets)
      || input.targets.length !== 1) return fail('synthetic_payload_invalid');
    const target: unknown = input.targets[0];
    if (!target || typeof target !== 'object' || !('integrationId' in target) || target.integrationId !== row.integrationId
      || !('channel' in target) || target.channel !== SYNTHETIC_PROVIDER || !('media' in target)
      || !Array.isArray(target.media) || target.media.length < 1 || target.media.length > 20) return fail('synthetic_payload_invalid');
    return { bodyHash: hash(JSON.stringify([row.contentHash, row.id, row.integrationId, target.media.length])), slideCount: target.media.length };
  }
  private async read(tx: Prisma.TransactionClient, scope: Scope, row: Occurrence): Promise<SyntheticReadback> {
    const slides = await tx.syntheticDeliveryReceipt.findMany({ where: scope, orderBy: { slideIndex: 'asc' }, take: 21 });
    const events = await tx.syntheticDeliveryEvent.findMany({ where: scope, orderBy: { ordinal: 'asc' }, take: 1001 });
    const bodyHash = slides[0]?.bodyHash ?? events[0]?.bodyHash ?? null;
    if (bodyHash !== null && bodyHash !== this.payload(row).bodyHash) return fail('synthetic_body_conflict');
    const kinds: readonly string[] = ['Attempted', 'TransientRejected', 'SlideCommitted', 'ResponseLost', 'Completed'];
    if (slides.length > 20 || events.length > 1000 || slides.some((slide, index) => slide.slideIndex !== index || slide.bodyHash !== bodyHash)
      || events.some((event, index) => event.ordinal !== index + 1 || event.bodyHash !== bodyHash || !kinds.includes(event.kind))) return fail('synthetic_journal_inconsistent');
    const complete = row.status === 'SIMULATED' && row.post.state === 'SIMULATED';
    if ((row.status === 'SIMULATED') !== (row.post.state === 'SIMULATED') || complete &&
      (slides.length !== this.payload(row).slideCount || !events.some(event => event.kind === 'Completed'))) return fail('synthetic_journal_inconsistent');
    return { contract: 'happym.synthetic-delivery/v1', mode: 'SIMULATION',
      status: complete ? 'SimulatedPublished' : slides.length ? 'Partial' : 'NotStarted',
      organizationId: scope.organizationId, integrationId: scope.integrationId, postId: scope.postId, occurrenceId: scope.occurrenceId, bodyHash,
      slides: slides.map(slide => ({ slideIndex: slide.slideIndex, syntheticReceiptId: slide.syntheticReceiptId, status: 'SimulatedCommitted' })),
      events: events.map(event => ({ ordinal: event.ordinal, kind: event.kind as SyntheticEventKind })) };
  }
  private requireIds(...ids: string[]) { if (!ids.every(syntheticIdentifier)) throw new BadRequestException({ code: 'synthetic_scope_invalid' }); }
  private requireSameBinding(expected: SyntheticBinding) {
    if (JSON.stringify(syntheticBinding()) !== JSON.stringify(expected))
      throw new SyntheticFixtureFault('SyntheticOutcomeUnknown');
  }
  private requireNativeCredential(actual: unknown) { requireSyntheticNativeCredential(actual); }
}
