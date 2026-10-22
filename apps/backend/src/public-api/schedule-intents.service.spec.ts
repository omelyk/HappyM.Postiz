import { createHash } from 'node:crypto';
import type { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { normalizePublicPostCommentSettings } from '@gitroom/backend/public-api/services/post.comment.settings';
import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { ScheduleIntentService, scheduleIntentContract } from '@gitroom/nestjs-libraries/database/prisma/schedule-intents/schedule-intent.service';
import { ScheduleIntentDispatcher } from '@gitroom/nestjs-libraries/database/prisma/schedule-intents/schedule-intent.dispatcher';

// Source tests with in-process collaborators. These do not qualify SQL isolation, Temporal or HA.
const now = new Date('2026-10-17T00:00:00Z');
const envelope = () => ({ contract: scheduleIntentContract, commandId: 'command-a', crmOccurrenceId: 'crm-occ-a',
  revisionId: 'revision-a', bindingKey: 'binding-test-a', post: { type: 'schedule', date: '2026-10-18T00:00:00Z',
    shortLink: false, tags: [] as CreatePostDto['tags'], posts: [{ integration: { id: 'integration-a' },
      value: [{ content: 'synthetic', image: [] as CreatePostDto['posts'][number]['value'][number]['image'] }], settings: {}, prePublishRender: { leadTimeSeconds: 600,
        correlation: { crmSocialPostId: 'crm-post-a', snapshotId: 'snapshot-a', pharmacyGroupId: 'group-a', pharmacyId: 'pharmacy-a' } } }] } });
const request = (value = envelope()) => {
  const payloadJson = JSON.stringify(value);
  return { payloadJson, payloadHash: `sha256-${createHash('sha256').update(payloadJson).digest('hex')}` };
};

function fixture() {
  let row: any = null;
  let ackExpired = false;
  const post = jest.fn(async () => ({ id: 'post-a' }));
  const occurrence = jest.fn(async () => ({ id: 'occ-a' }));
  const journal = {
    findUnique: jest.fn(async ({ where }: any) => row && where.organizationId_intentId.organizationId === row.organizationId
      && where.organizationId_intentId.intentId === row.intentId ? row : null),
    create: jest.fn(async ({ data }: any) => (row = { dispatchFence: 0, dispatchLeaseOwner: null,
      dispatchLeaseExpiresAt: null, dispatchState: 'pending', createdAt: now, ...data })),
    update: jest.fn(async ({ data }: any) => (row = { ...row, ...data })),
    updateMany: jest.fn(async ({ where, data }: any) => {
      if (!row || row.state !== where.state || row.dispatchState !== where.dispatchState
        || where.dispatchLeaseOwner && where.dispatchLeaseOwner !== row.dispatchLeaseOwner
        || typeof where.dispatchFence === 'number' && where.dispatchFence !== row.dispatchFence) return { count: 0 };
      row = { ...row, ...data, dispatchFence: data.dispatchFence?.increment
        ? row.dispatchFence + data.dispatchFence.increment : row.dispatchFence };
      return { count: 1 };
    })
  };
  const render = { create: occurrence, findFirst: jest.fn(async () => ({ id: 'occ-a', status: 'SCHEDULED' })),
    update: jest.fn(async () => ({})) };
  const tx = { editorialScheduleIntent: journal, integration: { findFirst: jest.fn(async () => ({ id: 'integration-a' })) },
    post: { create: post }, prePublishRenderOccurrence: render, $queryRaw: jest.fn(async () => [{ now }]) };
  const prisma: any = { ...tx, post: { ...tx.post, findFirst: jest.fn(async () => ({ id: 'post-a',
    integration: { providerIdentifier: 'facebook-page' } })) }, $transaction: jest.fn(async (work: any) => work(tx)),
    $executeRaw: jest.fn(async (sql: TemplateStringsArray, ...parameters: any[]) => {
      if (ackExpired || !row || row.state !== 'committed' || row.dispatchState !== 'pending'
        || row.organizationId !== parameters[0] || row.intentId !== parameters[1]
        || row.dispatchLeaseOwner !== parameters[2] || row.dispatchFence !== parameters[3]) return 0;
      row = { ...row, dispatchState: 'started', dispatchedAt: now, dispatchLeaseOwner: null, dispatchLeaseExpiresAt: null };
      return 1;
    }) };
  return { service: new ScheduleIntentService(prisma), prisma, journal, post, occurrence, render,
    row: () => row, expireBeforeAck: () => { ackExpired = true; }, seed: (value: any) => { row = value; } };
}

describe('current schedule intent service', () => {
  const old = process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
  beforeEach(() => { process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED = 'true'; });
  afterAll(() => { if (old === undefined) delete process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
    else process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED = old; });

  it('is closed before any journal access when activation is absent', async () => {
    delete process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
    const f = fixture();
    await expect(f.service.get('org-a', 'intent-a')).rejects.toMatchObject({ code: 'schedule_intents_disabled' });
    expect(f.journal.findUnique).not.toHaveBeenCalled();
  });

  it.each(['../other', 'a/b', '', 'a'.repeat(129)])('rejects invalid opaque intent ID %s', id => {
    expect(() => fixture().service.parse(id, request())).toThrow('schedule_intent_invalid');
  });

  it('hashes the exact frozen bytes, not a parsed/reordered payload', () => {
    const wire = request(); wire.payloadJson += ' ';
    expect(() => fixture().service.parse('intent-a', wire)).toThrow('schedule_intent_invalid');
  });

  it('rejects a second target in one v1 intent', () => {
    const value = envelope(); value.post.posts.push(value.post.posts[0]);
    expect(() => fixture().service.parse('intent-a', request(value))).toThrow('schedule_intent_invalid');
  });

  it('places post, render occurrence, links and pending dispatch in the same transaction callback', async () => {
    const f = fixture(); const wire = request();
    const accepted = await f.service.create('org-a', 'intent-a', wire, envelope().post as any);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(f.post).toHaveBeenCalledTimes(1); expect(f.occurrence).toHaveBeenCalledTimes(1);
    expect(f.journal.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: 'org-a', intentId: 'intent-a', postId: 'post-a', dispatchState: 'pending', payloadHash: wire.payloadHash }) });
    expect(accepted.links).toEqual([{ integrationId: 'integration-a', postId: 'post-a', occurrenceId: 'occ-a' }]);
  });

  it('rejects raw one value plus 100 normalized comments before any transaction', async () => {
    const f = fixture(); const value: any = envelope();
    value.post.posts[0].settings = { comments: Array.from({ length: 100 }, (_, i) => `synthetic-comment-${i}`) };
    const normalized = normalizePublicPostCommentSettings(value.post);
    expect(normalized.posts[0].value).toHaveLength(101);
    await expect(f.service.create('org-a', 'intent-a', request(value), normalized)).rejects.toMatchObject({ code: 'schedule_intent_invalid' });
    expect(f.prisma.$transaction).not.toHaveBeenCalled(); expect(f.post).not.toHaveBeenCalled();
  });

  it('recovers a lost response by exact read without another post create', async () => {
    const f = fixture(); const tx = f.prisma.$transaction;
    f.prisma.$transaction = async (...args: any[]) => { await tx(...args); throw new Error('synthetic-response-loss'); };
    await expect(f.service.create('org-a', 'intent-a', request(), envelope().post as any)).rejects.toThrow('synthetic-response-loss');
    const receipt = await f.service.get('org-a', 'intent-a');
    expect(receipt.state).toBe('committed'); expect(f.post).toHaveBeenCalledTimes(1);
  });

  it('replays a matching command and rejects changed payload under the same intent', async () => {
    const f = fixture();
    const accepted = await f.service.create('org-a', 'intent-a', request(), envelope().post as any);
    expect(await f.service.replay('org-a', 'intent-a', request())).toEqual(accepted);
    const changed = envelope(); changed.post.posts[0].value[0].content = 'changed';
    await expect(f.service.replay('org-a', 'intent-a', request(changed))).rejects.toMatchObject({ code: 'schedule_intent_conflict' });
    expect(f.post).toHaveBeenCalledTimes(1);
  });

  it('does not find another organization receipt', async () => {
    const f = fixture(); await f.service.create('org-a', 'intent-a', request(), envelope().post as any);
    await expect(f.service.get('org-b', 'intent-a')).rejects.toMatchObject({ code: 'schedule_intent_not_found' });
  });

  it('keeps a cancellation tombstone for a delayed create', async () => {
    const f = fixture(); const cancelled = await f.service.cancel('org-a', 'intent-a', request());
    expect(cancelled.state).toBe('cancelled'); expect(cancelled.links).toEqual([]);
    const replay = await f.service.create('org-a', 'intent-a', request(), envelope().post as any);
    expect(replay.state).toBe('cancelled'); expect(f.post).not.toHaveBeenCalled();
  });

  it.each(['PUBLISHING', 'PUBLISHED', 'FAILED', 'RENDER_TIMED_OUT'])('refuses cancellation with unresolved/unsafe state %s', async status => {
    const f = fixture(); await f.service.create('org-a', 'intent-a', request(), envelope().post as any);
    f.render.findFirst.mockResolvedValue({ id: 'occ-a', status });
    await expect(f.service.cancel('org-a', 'intent-a', request())).rejects.toMatchObject({ code: 'schedule_intent_cancel_unsafe' });
    expect(f.render.update).not.toHaveBeenCalled(); expect(f.journal.update).not.toHaveBeenCalled();
  });
});

describe('current intent dispatcher', () => {
  const old = process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
  beforeEach(() => { process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED = 'true'; });
  afterAll(() => { if (old === undefined) delete process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED;
    else process.env.HAPPYM_SCHEDULE_INTENTS_ENABLED = old; });
  async function prepared() {
    const f = fixture(); await f.service.create('org-a', 'intent-a', request(), envelope().post as any);
    const workflow = { start: jest.fn(async () => ({})), getHandle: jest.fn(() => ({ describe: jest.fn(async () => ({})) })) };
    const dispatcher = new ScheduleIntentDispatcher(f.prisma, { client: { getRawClient: () => ({ workflow }) } } as any);
    return { ...f, workflow, dispatcher };
  }
  it('does not call Temporal when the lease was not acquired', async () => {
    const f = await prepared(); f.journal.updateMany.mockResolvedValue({ count: 0 });
    expect(await f.dispatcher.dispatch('org-a', 'intent-a')).toBe(false);
    expect(f.workflow.start).not.toHaveBeenCalled();
  });
  it('ensures the stable workflow without terminating or reusing a completed ID', async () => {
    const f = await prepared(); expect(await f.dispatcher.dispatch('org-a', 'intent-a')).toBe(true);
    expect(f.workflow.start).toHaveBeenCalledWith('postWorkflowV107', expect.objectContaining({
      workflowId: 'post_post-a', workflowIdConflictPolicy: 'USE_EXISTING', workflowIdReusePolicy: 'REJECT_DUPLICATE' }));
    expect(f.row().dispatchState).toBe('started');
  });
  it('describes an existing execution without issuing a replacement start', async () => {
    const f = await prepared(); f.workflow.start.mockRejectedValue(Object.create(WorkflowExecutionAlreadyStartedError.prototype));
    expect(await f.dispatcher.dispatch('org-a', 'intent-a')).toBe(true);
    expect(f.workflow.start).toHaveBeenCalledTimes(1); expect(f.workflow.getHandle).toHaveBeenCalledWith('post_post-a');
  });
  it('retains pending dispatch after a lost Temporal response', async () => {
    const f = await prepared(); f.workflow.start.mockRejectedValue(new Error('synthetic-response-loss'));
    await expect(f.dispatcher.dispatch('org-a', 'intent-a')).rejects.toThrow('schedule_intent_dispatch_pending');
    expect(f.row().dispatchState).toBe('pending');
  });
  it('does not acknowledge expiry after the pre-RPC clock sample', async () => {
    const f = await prepared();
    f.workflow.start.mockImplementation(async () => { f.expireBeforeAck(); return {}; });
    expect(await f.dispatcher.dispatch('org-a', 'intent-a')).toBe(false);
    expect(f.row().dispatchState).toBe('pending');
    const [sql, ...parameters] = f.prisma.$executeRaw.mock.calls[0];
    expect(sql.join('?')).toContain('"dispatchLeaseExpiresAt">clock_timestamp()');
    expect(parameters).toHaveLength(4); expect(parameters.every((x: unknown) => !(x instanceof Date))).toBe(true);
  });

  it('does not acknowledge a lease invalidated while Temporal is in flight', async () => {
    const f = await prepared(); f.workflow.start.mockImplementation(async () => {
      f.seed({ ...f.row(), dispatchFence: f.row().dispatchFence + 1 }); return {};
    });
    expect(await f.dispatcher.dispatch('org-a', 'intent-a')).toBe(false);
    expect(f.row().dispatchState).toBe('pending');
  });
});
