import { PostActivity } from '@gitroom/orchestrator/activities/post.activity';
import {
  ActivityFailure,
  ApplicationFailure,
  continueAsNew,
  executeChild,
  proxyActivities,
  sleep,
} from '@temporalio/workflow';
import { TimeoutFailure } from '@temporalio/common';
import { postWorkflowV106 } from './post.workflow.v1.0.6';
import type { SyntheticReadback } from '@gitroom/nestjs-libraries/database/prisma/synthetic-fixture/synthetic-fixture.service';

const {
  getPost,
  ensureRenderOccurrence,
  markRenderAwaiting,
  getRenderWorkflowState,
  timeoutRenderOccurrence,
  beginRenderPublishing,
  completeRenderOccurrence,
} = proxyActivities<PostActivity>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 5,
    backoffCoefficient: 2,
    initialInterval: '2 seconds',
  },
});

// Synthetic mutations are DB-only and idempotent, but ambiguity still requires
// an explicit durable lookup. Do not alter real provider retry semantics.
const { deliverSyntheticFixture } = proxyActivities<PostActivity>({
  startToCloseTimeout: '30 seconds', retry: { maximumAttempts: 1 },
});
const { getSyntheticFixtureReadback } = proxyActivities<PostActivity>({
  startToCloseTimeout: '15 seconds', retry: { maximumAttempts: 3 },
});

export type PostWorkflowV107Input = {
  taskQueue: string;
  postId: string;
  organizationId: string;
  scheduledFor?: string;
  sequence?: number;
};

/**
 * Durable pre-publish render gate. The database occurrence is the source of
 * truth, so replay/restart cannot consume a lease or bypass an unattached
 * render. V106 remains the real-provider delivery implementation; isolated
 * synthetic delivery has a separate journal and explicit SIMULATED states.
 */
export async function postWorkflowV107(input: PostWorkflowV107Input): Promise<void | SyntheticReadback> {
  const post = await getPost(input.organizationId, input.postId);
  if (!post) return;

  const synthetic = post.integration?.providerIdentifier === 'happym-test-fixture';
  if (synthetic && !post.renderRequired) throw new Error('synthetic_render_required');

  if (!post.renderRequired) {
    await executeChild(postWorkflowV106, {
      workflowId: `delivery_${input.postId}_legacy`,
      args: [input],
    });
    return;
  }

  const sequence = input.sequence ?? 0;
  const scheduledFor = new Date(input.scheduledFor || post.publishDate);
  let correlation: Record<string, string> = {};
  let correlationValid = true;
  try {
    correlation = JSON.parse(post.renderCorrelation || '{}');
  } catch {
    correlationValid = false;
  }

  const occurrence = await ensureRenderOccurrence(
    input.organizationId,
    input.postId,
    post.integrationId,
    sequence,
    scheduledFor,
    post.renderLeadTimeSeconds,
    correlation as any
  );
  const renderDeadline = 'renderDeadlineUtc' in occurrence
    ? new Date(String(occurrence.renderDeadlineUtc)) : scheduledFor;
  if (!Number.isFinite(renderDeadline.getTime()) || renderDeadline < scheduledFor) {
    await timeoutRenderOccurrence(input.organizationId, occurrence.occurrenceId);
    return;
  }
  if (synthetic && post.state === 'SIMULATED')
    return getSyntheticFixtureReadback(input.organizationId, input.postId, occurrence.occurrenceId);
  if (!correlationValid) {
    await timeoutRenderOccurrence(
      input.organizationId,
      occurrence.occurrenceId
    );
    return;
  }

  const leadAt =
    scheduledFor.getTime() - Math.max(60, post.renderLeadTimeSeconds) * 1000;
  if (leadAt > Date.now()) await sleep(leadAt - Date.now());
  await markRenderAwaiting(input.organizationId, occurrence.occurrenceId);

  while (Date.now() < renderDeadline.getTime()) {
    const state = await getRenderWorkflowState(
      input.organizationId,
      occurrence.occurrenceId
    );
    if (synthetic && state.status === 'SimulatedPublished')
      return getSyntheticFixtureReadback(input.organizationId, input.postId, occurrence.occurrenceId);
    if (state.status === 'ReadyToPublish') break;
    if (
      state.status === 'Cancelled' ||
      state.status === 'RenderTimedOut' ||
      state.status === 'Missing'
    ) {
      return;
    }
    await sleep(Math.min(5000, renderDeadline.getTime() - Date.now()));
  }

  const finalState = await getRenderWorkflowState(
    input.organizationId,
    occurrence.occurrenceId
  );
  if (synthetic && finalState.status === 'SimulatedPublished')
    return getSyntheticFixtureReadback(input.organizationId, input.postId, occurrence.occurrenceId);
  if (finalState.status !== 'ReadyToPublish') {
    await timeoutRenderOccurrence(
      input.organizationId,
      occurrence.occurrenceId
    );
    return;
  }

  if (scheduledFor.getTime() > Date.now()) {
    await sleep(scheduledFor.getTime() - Date.now());
  }
  if (synthetic) {
    // No V106, provider lookup, OAuth/refresh, comments, plugs or webhooks.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const committed = await deliverSyntheticFixture(input.organizationId, input.postId, occurrence.occurrenceId);
        if (committed.status === 'SimulatedPublished') return committed;
      } catch (error) {
        const cause = error instanceof ActivityFailure ? error.cause : error;
        if (!(cause instanceof TimeoutFailure) && !(cause instanceof ApplicationFailure
          && (cause.type === 'SyntheticOutcomeUnknown' || cause.type === 'SyntheticTransientBeforeCommit'))) throw error;
        // A lost response is not a failed commit. Exact scoped readback below is
        // mandatory before resuming any missing synthetic slides.
      }
      const observed = await getSyntheticFixtureReadback(input.organizationId, input.postId, occurrence.occurrenceId);
      if (observed.status === 'SimulatedPublished') return observed;
      if (attempt < 2) await sleep('1 second');
    }
    throw new Error('synthetic_delivery_unknown');
  }
  await beginRenderPublishing(input.organizationId, occurrence.occurrenceId);
  const delivery = await executeChild(postWorkflowV106, {
    workflowId: `delivery_${occurrence.occurrenceId}`,
    args: [
      {
        taskQueue: input.taskQueue,
        postId: input.postId,
        organizationId: input.organizationId,
        postNow: true,
        disableRepeat: true,
      },
    ],
  });
  await completeRenderOccurrence(
    input.organizationId,
    occurrence.occurrenceId,
    delivery && typeof delivery === 'object' ? delivery.receipts || [] : []
  );

  if (post.intervalInDays) {
    const nextScheduledFor = new Date(
      scheduledFor.getTime() + post.intervalInDays * 24 * 60 * 60 * 1000
    );
    await continueAsNew<typeof postWorkflowV107>({
      ...input,
      scheduledFor: nextScheduledFor.toISOString(),
      sequence: sequence + 1,
    });
  }
}
