import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { EditorialScheduleIntent, Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';

export const scheduleIntentContract = 'editorial.schedule-intent/v1';
export const scheduleIntentsEnabled = () => process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED === 'true';

export class ScheduleIntentError extends Error {
  constructor(public readonly code: string, public readonly status: HttpStatus) { super(code); }
}
export type ScheduleIntentRequest = { payloadJson: string; payloadHash: string };
export type ScheduleIntentEnvelope = {
  contract: string; commandId: string; crmOccurrenceId: string; revisionId: string;
  bindingKey: string; post: CreatePostDto;
};
export type ScheduleIntentLink = { integrationId: string; postId: string; occurrenceId: string };
export type ScheduleIntentReceipt = {
  contract: string; intentId: string; payloadHash: string; commandId: string;
  crmOccurrenceId: string; revisionId: string; bindingKey: string; organizationId: string;
  state: string; dispatchState: string; links: ScheduleIntentLink[];
};
const invalid = () => new ScheduleIntentError('schedule_intent_invalid', HttpStatus.BAD_REQUEST);
const token = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const metadata = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 256;

@Injectable()
export class ScheduleIntentService {
  constructor(private readonly prisma: PrismaService) {}

  private requireEnabled() {
    if (!scheduleIntentsEnabled()) throw new ScheduleIntentError('schedule_intents_disabled', HttpStatus.SERVICE_UNAVAILABLE);
  }
  parse(intentId: string, request: ScheduleIntentRequest): ScheduleIntentEnvelope {
    this.requireEnabled();
    if (!token(intentId) || !request || typeof request.payloadJson !== 'string' ||
        Buffer.byteLength(request.payloadJson, 'utf8') > 256 * 1024 ||
        !/^sha256-[a-f0-9]{64}$/.test(request.payloadHash || '')) throw invalid();
    const hash = `sha256-${createHash('sha256').update(request.payloadJson, 'utf8').digest('hex')}`;
    if (hash !== request.payloadHash) throw invalid();
    let value: ScheduleIntentEnvelope;
    try { value = JSON.parse(request.payloadJson); } catch { throw invalid(); }
    if (!value || value.contract !== scheduleIntentContract ||
        ![value.commandId, value.crmOccurrenceId, value.revisionId, value.bindingKey].every(metadata)) throw invalid();
    const post = value.post;
    if (!post || post.type !== 'schedule' || !Array.isArray(post.posts) || post.posts.length !== 1 ||
        !Number.isFinite(Date.parse(post.date)) || post.shortLink !== false ||
        (post.tags?.length || 0) !== 0 || post.inter != null || post.order != null) throw invalid();
    const target = post.posts[0];
    if (!target || !metadata(target.integration?.id) || target.group ||
        !Array.isArray(target.value) || target.value.length < 1 || target.value.length > 100 ||
        target.value.some(v => !!v.id) || !target.prePublishRender) throw invalid();
    const cfg = target.prePublishRender;
    if (!cfg.correlation || ![cfg.correlation.crmSocialPostId, cfg.correlation.snapshotId,
        cfg.correlation.pharmacyGroupId, cfg.correlation.pharmacyId].every(metadata) ||
        !Number.isInteger(cfg.leadTimeSeconds ?? 600) || (cfg.leadTimeSeconds ?? 600) < 60 ||
        (cfg.leadTimeSeconds ?? 600) > 3600) throw invalid();
    return value;
  }

  private receipt(row: EditorialScheduleIntent): ScheduleIntentReceipt {
    return { contract: scheduleIntentContract, intentId: row.intentId, payloadHash: row.payloadHash,
      commandId: row.commandId, crmOccurrenceId: row.crmOccurrenceId, revisionId: row.revisionId,
      bindingKey: row.bindingKey, organizationId: row.organizationId, state: row.state,
      dispatchState: row.dispatchState, links: JSON.parse(row.linksJson) };
  }
  private samePayload(row: EditorialScheduleIntent, request: ScheduleIntentRequest) {
    if (row.payloadHash !== request.payloadHash || row.payloadJson !== request.payloadJson)
      throw new ScheduleIntentError('schedule_intent_conflict', HttpStatus.CONFLICT);
  }
  async get(organizationId: string, intentId: string): Promise<ScheduleIntentReceipt> {
    this.requireEnabled();
    if (!token(intentId)) throw invalid();
    const row = await this.prisma.editorialScheduleIntent.findUnique({ where: {
      organizationId_intentId: { organizationId, intentId } } });
    if (!row) throw new ScheduleIntentError('schedule_intent_not_found', HttpStatus.NOT_FOUND);
    return this.receipt(row);
  }
  async replay(organizationId: string, intentId: string, request: ScheduleIntentRequest): Promise<ScheduleIntentReceipt | null> {
    this.parse(intentId, request);
    const row = await this.prisma.editorialScheduleIntent.findUnique({ where: {
      organizationId_intentId: { organizationId, intentId } } });
    if (!row) return null;
    this.samePayload(row, request);
    return this.receipt(row);
  }

  async create(organizationId: string, intentId: string, request: ScheduleIntentRequest,
    normalized: CreatePostDto): Promise<ScheduleIntentReceipt> {
    const envelope = this.parse(intentId, request);
    if (!normalized || normalized.type !== 'schedule' || !Array.isArray(normalized.posts) || normalized.posts.length !== 1 ||
        !normalized.posts[0] || !Array.isArray(normalized.posts[0].value) ||
        normalized.posts[0].value.length < 1 || normalized.posts[0].value.length > 100 ||
        normalized.posts[0].integration?.id !== envelope.post.posts[0].integration.id ||
        !normalized.posts[0].prePublishRender ||
        (['crmSocialPostId', 'snapshotId', 'pharmacyGroupId', 'pharmacyId'] as const).some(key =>
          normalized.posts[0].prePublishRender!.correlation[key] !==
          envelope.post.posts[0].prePublishRender!.correlation[key])) throw invalid();
    return this.prisma.$transaction(async tx => {
      const existing = await tx.editorialScheduleIntent.findUnique({ where: {
        organizationId_intentId: { organizationId, intentId } } });
      if (existing) { this.samePayload(existing, request); return this.receipt(existing); }
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`;
      const scheduledFor = new Date(envelope.post.date);
      // This is a durable planning effect, including an intent delayed by an outage.
      // Preserve the requested instant and exact frozen payload. Publication still
      // requires the separate, current pre-publish render/consent gate.
      const target = normalized.posts[0];
      const integration = await tx.integration.findFirst({ where: {
        id: target.integration.id, organizationId, deletedAt: null, disabled: false } });
      if (!integration) throw invalid();
      const cfg = target.prePublishRender!;
      const group = randomUUID();
      let rootPostId: string | undefined;
      let parentPostId: string | undefined;
      for (const value of target.value) {
        const post = await tx.post.create({ data: {
          id: randomUUID(), organizationId, integrationId: integration.id, state: 'QUEUE',
          publishDate: scheduledFor, content: value.content, delay: value.delay || 0,
          group, parentPostId, settings: JSON.stringify(target.settings), image: JSON.stringify(value.image),
          creationMethod: 'API', renderRequired: true, renderLeadTimeSeconds: cfg.leadTimeSeconds ?? 600,
          renderCorrelation: JSON.stringify(cfg.correlation) } });
        rootPostId ??= post.id;
        parentPostId = post.id;
      }
      const occurrence = await tx.prePublishRenderOccurrence.create({ data: {
        organizationId, postId: rootPostId!, integrationId: integration.id, sequence: 0,
        scheduledFor, leadTimeSeconds: cfg.leadTimeSeconds ?? 600,
        correlation: JSON.stringify(cfg.correlation), createdAt: now } });
      const links: ScheduleIntentLink[] = [{ integrationId: integration.id,
        postId: rootPostId!, occurrenceId: occurrence.id }];
      const row = await tx.editorialScheduleIntent.create({ data: {
        organizationId, intentId, payloadHash: request.payloadHash, payloadJson: request.payloadJson,
        commandId: envelope.commandId, crmOccurrenceId: envelope.crmOccurrenceId,
        revisionId: envelope.revisionId, bindingKey: envelope.bindingKey, state: 'committed',
        postId: rootPostId!,
        linksJson: JSON.stringify(links), dispatchState: 'pending', createdAt: now } });
      // No Temporal or provider call inside this transaction.
      return this.receipt(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancel(organizationId: string, intentId: string, request: ScheduleIntentRequest): Promise<ScheduleIntentReceipt> {
    const envelope = this.parse(intentId, request);
    return this.prisma.$transaction(async tx => {
      const existing = await tx.editorialScheduleIntent.findUnique({ where: {
        organizationId_intentId: { organizationId, intentId } } });
      if (existing) {
        this.samePayload(existing, request);
        if (existing.state === 'cancelled') return this.receipt(existing);
        const links: ScheduleIntentLink[] = JSON.parse(existing.linksJson);
        for (const link of links) {
          const current = await tx.prePublishRenderOccurrence.findFirst({ where: {
            id: link.occurrenceId, organizationId, postId: link.postId, integrationId: link.integrationId } });
          if (!current || !['SCHEDULED', 'AWAITING_RENDER', 'READY_TO_PUBLISH', 'CANCELLED'].includes(current.status))
            throw new ScheduleIntentError('schedule_intent_cancel_unsafe', HttpStatus.CONFLICT);
          if (['SCHEDULED', 'AWAITING_RENDER', 'READY_TO_PUBLISH'].includes(current.status))
            await tx.prePublishRenderOccurrence.update({ where: { id: current.id }, data: {
              status: 'CANCELLED', failureReason: 'OccurrenceCancelled' } });
        }
        const cancelled = await tx.editorialScheduleIntent.update({ where: {
          organizationId_intentId: { organizationId, intentId } }, data: {
          state: 'cancelled', dispatchState: 'cancelled', dispatchFence: { increment: 1 },
          dispatchLeaseOwner: null, dispatchLeaseExpiresAt: null } });
        return this.receipt(cancelled);
      }
      // A tombstone prevents an older, still in-flight create from creating a post later.
      const row = await tx.editorialScheduleIntent.create({ data: {
        organizationId, intentId, payloadHash: request.payloadHash, payloadJson: request.payloadJson,
        commandId: envelope.commandId, crmOccurrenceId: envelope.crmOccurrenceId,
        revisionId: envelope.revisionId, bindingKey: envelope.bindingKey,
        state: 'cancelled', dispatchState: 'cancelled', linksJson: '[]' } });
      return this.receipt(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
