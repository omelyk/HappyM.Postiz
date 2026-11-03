-- Explicit native installer migration, NOT a startup grant/data script.
CREATE TABLE "NativeWorkspaceOwner31" (
 "organizationId" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL UNIQUE,
 "consumerKey" CHAR(64) NOT NULL,
 "metadataJson" TEXT NOT NULL,
 UNIQUE ("consumerKey", "metadataJson")
);
CREATE TABLE "NativeOperationalRegistration31" (
 "operationId" CHAR(64) NOT NULL PRIMARY KEY,
 "requestId" CHAR(32) NOT NULL UNIQUE,
 "consumerKey" CHAR(64) NOT NULL,
 "revision" INTEGER NOT NULL,
 "previousOperationId" CHAR(64),
 "receiptJson" TEXT NOT NULL,
 UNIQUE ("consumerKey", "revision"),
 FOREIGN KEY ("previousOperationId") REFERENCES "NativeOperationalRegistration31"("operationId") ON DELETE RESTRICT ON UPDATE RESTRICT
);
-- No row insertion, backfill, user/credential creation or customer grant here.
