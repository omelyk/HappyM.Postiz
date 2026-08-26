import { PostActivity } from '@gitroom/orchestrator/activities/post.activity';
import {
  continueAsNew,
  executeChild,
  proxyActivities,
  sleep,
} from '@temporalio/workflow';
import { postWorkflowV106 } from './post.workflow.v1.0.6';

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
 * render. The existing V106 workflow remains the sole delivery implementation.
 */
export async function postWorkflowV107(input: PostWorkflowV107Input) {
  const post = await getPost(input.organizationId, input.postId);
  if (!post) return;

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

  while (Date.now() < scheduledFor.getTime()) {
    const state = await getRenderWorkflowState(
      input.organizationId,
      occurrence.occurrenceId
    );
    if (state.status === 'ReadyToPublish') break;
    if (
      state.status === 'Cancelled' ||
      state.status === 'RenderTimedOut' ||
      state.status === 'Missing'
    ) {
      return;
    }
    await sleep(Math.min(5000, scheduledFor.getTime() - Date.now()));
  }

  const finalState = await getRenderWorkflowState(
    input.organizationId,
    occurrence.occurrenceId
  );
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
  await beginRenderPublishing(input.organizationId, occurrence.occurrenceId);
  await executeChild(postWorkflowV106, {
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
  await completeRenderOccurrence(input.organizationId, occurrence.occurrenceId);

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
