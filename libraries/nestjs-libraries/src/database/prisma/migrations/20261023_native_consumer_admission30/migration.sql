-- Explicit Root-owned migration; never invoked by startup or Prisma db-push.
CREATE TABLE "NativeConsumerAdmission30" (
 "admissionId" CHAR(64) NOT NULL PRIMARY KEY,
 "requestId" CHAR(32) NOT NULL,
 "receiptJson" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "NativeConsumerScopeAdmission30" (
 "organizationId" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL UNIQUE,
 "admissionId" CHAR(64) NOT NULL,
 "tenantId" TEXT NOT NULL,
 "pharmacyId" TEXT NOT NULL,
 CONSTRAINT "NativeConsumerScopeAdmission30_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "NativeConsumerAdmission30"("admissionId") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "NativeConsumerScopeAdmission30_admissionId_pharmacyId_key" UNIQUE ("admissionId", "pharmacyId")
);
