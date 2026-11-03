import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { organizationId as organizationAttribute, postId as postAttribute } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { ScheduleIntentLink, scheduleIntentsEnabled } from './schedule-intent.service';

@Injectable()
export class ScheduleIntentDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly worker = `schedule-intent-${randomUUID()}`;
  private readonly log = new Logger(ScheduleIntentDispatcher.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly temporal: TemporalService) {}

  onModuleInit() {
    if (scheduleIntentsEnabled()) {
      this.timer = setInterval(() => { void this.tick(); }, 5000);
      this.timer.unref();
    }
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick(): Promise<void> {
    if (!scheduleIntentsEnabled() || this.running) return;
    this.running = true;
    try {
      const [{ now }] = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`;
      const pending = await this.prisma.editorialScheduleIntent.findMany({ where: {
        state: 'committed', dispatchState: 'pending', OR: [
          { dispatchLeaseExpiresAt: null }, { dispatchLeaseExpiresAt: { lte: now } } ] },
        orderBy: { createdAt: 'asc' }, take: 25, select: { organizationId: true, intentId: true } });
      for (const row of pending) {
        try { await this.dispatch(row.organizationId, row.intentId); }
        catch { this.log.warn('schedule_intent_dispatch_pending'); }
      }
    } catch { this.log.warn('schedule_intent_dispatch_pending'); }
    finally { this.running = false; }
  }

  async dispatch(organizationId: string, intentId: string): Promise<boolean> {
    if (!scheduleIntentsEnabled()) return false;
    const lease = await this.prisma.$transaction(async tx => {
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`;
      const changed = await tx.editorialScheduleIntent.updateMany({ where: {
        organizationId, intentId, state: 'committed', dispatchState: 'pending', OR: [
          { dispatchLeaseExpiresAt: null }, { dispatchLeaseExpiresAt: { lte: now } } ] }, data: {
          dispatchLeaseOwner: this.worker, dispatchLeaseExpiresAt: new Date(now.getTime() + 60000),
          dispatchFence: { increment: 1 } } });
      if (changed.count !== 1) return null;
      return tx.editorialScheduleIntent.findUnique({ where: {
        organizationId_intentId: { organizationId, intentId } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!lease) return false;
    const links: ScheduleIntentLink[] = JSON.parse(lease.linksJson);
    try {
      const client = this.temporal.client.getRawClient();
      if (!client || links.length !== 1) throw new Error('schedule_intent_dispatch_pending');
      for (const link of links) {
        const current = await this.prisma.editorialScheduleIntent.findUnique({ where: {
          organizationId_intentId: { organizationId, intentId } } });
        const [{ now: beforeRpc }] = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`;
        if (!current || current.state !== 'committed' || current.dispatchState !== 'pending' ||
            current.dispatchLeaseOwner !== this.worker || current.dispatchFence !== lease.dispatchFence ||
            !current.dispatchLeaseExpiresAt || current.dispatchLeaseExpiresAt <= beforeRpc) return false;
        const post = await this.prisma.post.findFirst({ where: {
          id: link.postId, organizationId, integrationId: link.integrationId,
          deletedAt: null, renderRequired: true }, include: { integration: true } });
        if (!post) throw new Error('schedule_intent_dispatch_pending');
        try {
          await client.workflow.start('postWorkflowV107', {
            workflowId: `post_${post.id}`, taskQueue: 'main',
            workflowIdConflictPolicy: 'USE_EXISTING', workflowIdReusePolicy: 'REJECT_DUPLICATE',
            args: [{ taskQueue: post.integration.providerIdentifier.split('-')[0].toLowerCase(),
              postId: post.id, organizationId }],
            typedSearchAttributes: new TypedSearchAttributes([
              { key: postAttribute, value: post.id }, { key: organizationAttribute, value: organizationId } ])
          });
        } catch (error) {
          if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
          // A completed/previous execution is not restarted to manufacture success.
          await client.workflow.getHandle(`post_${post.id}`).describe();
        }
      }
      // Check expiry inside the atomic acknowledgement, not against a previously sampled clock.
      const saved = await this.prisma.$executeRaw`
        UPDATE "EditorialScheduleIntent"
        SET "dispatchState"='started', "dispatchedAt"=clock_timestamp(),
            "dispatchLeaseOwner"=NULL, "dispatchLeaseExpiresAt"=NULL, "updatedAt"=clock_timestamp()
        WHERE "organizationId"=${organizationId} AND "intentId"=${intentId}
          AND "state"='committed' AND "dispatchState"='pending'
          AND "dispatchLeaseOwner"=${this.worker} AND "dispatchFence"=${lease.dispatchFence}
          AND "dispatchLeaseExpiresAt">clock_timestamp()`;
      return saved === 1;
    } catch {
      await this.prisma.editorialScheduleIntent.updateMany({ where: {
        organizationId, intentId, state: 'committed', dispatchState: 'pending',
        dispatchLeaseOwner: this.worker, dispatchFence: lease.dispatchFence }, data: {
        dispatchLeaseOwner: null, dispatchLeaseExpiresAt: null } });
      throw new Error('schedule_intent_dispatch_pending');
    }
  }
}
