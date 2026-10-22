-- SOURCE CANDIDATE ONLY. Not applied. Root must qualify a new engine schema/image.
BEGIN;
CREATE TABLE "EditorialScheduleIntent" (
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id"),
  "intentId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "commandId" TEXT NOT NULL,
  "crmOccurrenceId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "bindingKey" TEXT NOT NULL,
  "postId" TEXT UNIQUE REFERENCES "Post"("id"),
  "state" TEXT NOT NULL DEFAULT 'committed' CHECK ("state" IN ('committed','cancelled')),
  "linksJson" TEXT NOT NULL,
  "dispatchState" TEXT NOT NULL DEFAULT 'pending' CHECK ("dispatchState" IN ('pending','started','cancelled')),
  "dispatchLeaseOwner" TEXT,
  "dispatchLeaseExpiresAt" TIMESTAMP(3),
  "dispatchFence" INTEGER NOT NULL DEFAULT 0,
  "dispatchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("organizationId","intentId")
);
CREATE INDEX "EditorialScheduleIntent_state_dispatchState_lease_created_idx"
  ON "EditorialScheduleIntent"("state","dispatchState","dispatchLeaseExpiresAt","createdAt");
CREATE INDEX "EditorialScheduleIntent_organizationId_commandId_idx"
  ON "EditorialScheduleIntent"("organizationId","commandId");
COMMIT;
