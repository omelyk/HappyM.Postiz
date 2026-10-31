-- SOURCE ONLY. Root owns SQL execution. Canonical shape bytes: UTF-8 of the
-- next JSON line after '-- ', without a trailing newline; property order matters.
-- HAPPYM_CONTRACT_SHAPE_V1_BEGIN
-- {"version":"happym.editorial-schedule-intent.pg-shape/v1","contract":"editorial.schedule-intent/v1","table":"public.EditorialScheduleIntent","columns":[["organizationId","text",false,null],["intentId","text",false,null],["payloadHash","text",false,null],["payloadJson","text",false,null],["commandId","text",false,null],["crmOccurrenceId","text",false,null],["revisionId","text",false,null],["bindingKey","text",false,null],["postId","text",true,null],["state","text",false,"'committed'::text"],["linksJson","text",false,null],["dispatchState","text",false,"'pending'::text"],["dispatchLeaseOwner","text",true,null],["dispatchLeaseExpiresAt","timestamp(3) without time zone",true,null],["dispatchFence","integer",false,"0"],["dispatchedAt","timestamp(3) without time zone",true,null],["createdAt","timestamp(3) without time zone",false,"CURRENT_TIMESTAMP"],["updatedAt","timestamp(3) without time zone",false,null]],"primaryKey":["organizationId","intentId"],"unique":[["postId"]],"foreignKeys":[["organizationId","public.Organization","id","NO ACTION","NO ACTION"],["postId","public.Post","id","NO ACTION","NO ACTION"]],"indexes":[["EditorialScheduleIntent_pkey",true,["organizationId","intentId"]],["EditorialScheduleIntent_postId_key",true,["postId"]],["EditorialScheduleIntent_state_dispatchState_lease_created_idx",false,["state","dispatchState","dispatchLeaseExpiresAt","createdAt"]],["EditorialScheduleIntent_organizationId_commandId_idx",false,["organizationId","commandId"]]],"checks":[["EditorialScheduleIntent_state_check","state",["committed","cancelled"]],["EditorialScheduleIntent_dispatchState_check","dispatchState",["pending","started","cancelled"]]],"ledger":{"table":"public.HappyMEngineSchemaLedger","columns":[["contract","text",false,null],["migrationName","text",false,null],["sourceSqlSha256","text",false,null],["contractShapeSha256","text",false,null],["appliedAtUtc","timestamp with time zone",false,"clock_timestamp()"]],"primaryKey":["contract"],"migrationName":"20261018-editorial-schedule-intents-contract","sourceSqlSha256":"2B57DD45A9B619CC52CD88851419DA390F6E8ED2C5979B69D59EEB3F1FDBFA25"}}
-- HAPPYM_CONTRACT_SHAPE_V1_END

BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $install_current_contract$
DECLARE
  expected_contract CONSTANT text := 'editorial.schedule-intent/v1';
  expected_migration CONSTANT text := '20261018-editorial-schedule-intents-contract';
  expected_source_sha CONSTANT text := '2B57DD45A9B619CC52CD88851419DA390F6E8ED2C5979B69D59EEB3F1FDBFA25';
  expected_shape_sha CONSTANT text := '910F7713BA87B417BAF122F9290AB9B9956C65FB47A45B8886FB1FB5412C9BB1';
  journal regclass;
  ledger regclass;
  expected_columns jsonb;
  actual_columns jsonb;
  actual_indexes jsonb;
  wanted_indexes CONSTANT jsonb := '[
    ["EditorialScheduleIntent_organizationId_commandId_idx","btree",false,false,["organizationId","commandId"]],
    ["EditorialScheduleIntent_pkey","btree",true,true,["organizationId","intentId"]],
    ["EditorialScheduleIntent_postId_key","btree",true,false,["postId"]],
    ["EditorialScheduleIntent_state_dispatchState_lease_created_idx","btree",false,false,["state","dispatchState","dispatchLeaseExpiresAt","createdAt"]]
  ]'::jsonb;
  item record;
  observed_expression text;
  ledger_row record;
BEGIN
  -- Installation serialization is transaction-scoped and has the bounded lock timeout.
  PERFORM pg_advisory_xact_lock(hashtextextended(expected_contract, 0));
  IF to_regclass('public."Organization"') IS NULL
      OR to_regclass('public."Post"') IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_missing_base';
  END IF;
  IF (SELECT count(*) FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('Organization', 'Post')
          AND c.relkind = 'r' AND c.relpersistence = 'p') <> 2 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_base_kind';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid IN ('public."Organization"'::regclass, 'public."Post"'::regclass)
          AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped
          AND a.atttypid = 'text'::regtype AND a.attnotnull) <> 2 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_base_id';
  END IF;

  -- Temporary catalog templates produce PostgreSQL's own type/default/CHECK
  -- normalization. They are never application tables and disappear at COMMIT.
  CREATE TEMP TABLE "HappyMIntentExpectedShape18" (
    "organizationId" text NOT NULL,
    "intentId" text NOT NULL,
    "payloadHash" text NOT NULL,
    "payloadJson" text NOT NULL,
    "commandId" text NOT NULL,
    "crmOccurrenceId" text NOT NULL,
    "revisionId" text NOT NULL,
    "bindingKey" text NOT NULL,
    "postId" text,
    "state" text NOT NULL DEFAULT 'committed',
    "linksJson" text NOT NULL,
    "dispatchState" text NOT NULL DEFAULT 'pending',
    "dispatchLeaseOwner" text,
    "dispatchLeaseExpiresAt" timestamp(3),
    "dispatchFence" integer NOT NULL DEFAULT 0,
    "dispatchedAt" timestamp(3),
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL,
    CONSTRAINT "EditorialScheduleIntent_state_check" CHECK ("state" IN ('committed', 'cancelled')),
    CONSTRAINT "EditorialScheduleIntent_dispatchState_check" CHECK ("dispatchState" IN ('pending', 'started', 'cancelled'))
  ) ON COMMIT DROP;

  journal := to_regclass('public."EditorialScheduleIntent"');
  IF journal IS NULL THEN
    IF to_regclass('public."HappyMEngineSchemaLedger"') IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public."HappyMEngineSchemaLedger" WHERE "contract" = expected_contract) THEN
        RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_missing_journal_with_ledger';
      END IF;
    END IF;
    CREATE TABLE public."EditorialScheduleIntent" (
      LIKE pg_temp."HappyMIntentExpectedShape18" INCLUDING DEFAULTS INCLUDING CONSTRAINTS,
      CONSTRAINT "EditorialScheduleIntent_pkey" PRIMARY KEY ("organizationId", "intentId"),
      CONSTRAINT "EditorialScheduleIntent_postId_key" UNIQUE ("postId"),
      CONSTRAINT "EditorialScheduleIntent_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES public."Organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT "EditorialScheduleIntent_postId_fkey" FOREIGN KEY ("postId")
        REFERENCES public."Post"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    );
    CREATE INDEX "EditorialScheduleIntent_state_dispatchState_lease_created_idx"
      ON public."EditorialScheduleIntent"("state", "dispatchState", "dispatchLeaseExpiresAt", "createdAt");
    CREATE INDEX "EditorialScheduleIntent_organizationId_commandId_idx"
      ON public."EditorialScheduleIntent"("organizationId", "commandId");
    journal := 'public."EditorialScheduleIntent"'::regclass;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = journal AND relkind = 'r'
      AND relpersistence = 'p' AND NOT relrowsecurity AND NOT relforcerowsecurity)
      OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = journal OR inhparent = journal)
      OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = journal AND NOT tgisinternal)
      OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class = journal) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_unknown_journal_kind';
  END IF;
  LOCK TABLE public."EditorialScheduleIntent" IN ACCESS EXCLUSIVE MODE;

  SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
      a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, a.attcollation)
      ORDER BY a.attnum) INTO expected_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'pg_temp."HappyMIntentExpectedShape18"'::regclass AND a.attnum > 0;
  SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
      a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, a.attcollation)
      ORDER BY a.attnum) INTO actual_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = journal AND a.attnum > 0;
  IF actual_columns IS DISTINCT FROM expected_columns THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_columns18';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = journal AND
       (c.conname NOT IN ('EditorialScheduleIntent_pkey', 'EditorialScheduleIntent_postId_key',
         'EditorialScheduleIntent_organizationId_fkey', 'EditorialScheduleIntent_postId_fkey',
         'EditorialScheduleIntent_state_check', 'EditorialScheduleIntent_dispatchState_check')
        OR c.condeferrable OR c.condeferred OR NOT c.convalidated OR NOT c.conislocal
        OR c.coninhcount <> 0 OR (c.contype = 'c' AND c.connoinherit))) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_unknown_constraint';
  END IF;
  IF (SELECT count(*) FROM pg_constraint c WHERE c.conrelid = journal AND c.contype = 'p'
      AND c.conname = 'EditorialScheduleIntent_pkey'
      AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
        JOIN pg_attribute a ON a.attrelid = journal AND a.attnum = k.num ORDER BY k.ord)
        = ARRAY['organizationId', 'intentId']) <> 1
      OR (SELECT count(*) FROM pg_constraint WHERE conrelid = journal AND contype = 'p') <> 1 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_primary_key';
  END IF;
  -- A Prisma-created standalone unique index and SQL's UNIQUE constraint are
  -- equivalent here; either is accepted only with the exact index facts below.
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = journal AND c.contype = 'u'
       AND (c.conname <> 'EditorialScheduleIntent_postId_key'
         OR ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
           JOIN pg_attribute a ON a.attrelid = journal AND a.attnum = k.num ORDER BY k.ord)
           <> ARRAY['postId'])) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_unique_constraint';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = journal AND contype = 'f') <> 2
      OR (SELECT count(*) FROM pg_constraint c
        JOIN (VALUES
          ('EditorialScheduleIntent_organizationId_fkey', 'organizationId', 'public."Organization"'::regclass),
          ('EditorialScheduleIntent_postId_fkey', 'postId', 'public."Post"'::regclass)
        ) e(name, column_name, target) ON c.conname = e.name
        WHERE c.conrelid = journal AND c.contype = 'f' AND c.confrelid = e.target
          AND c.confdeltype = 'a' AND c.confupdtype = 'a' AND c.confmatchtype = 's'
          AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
            JOIN pg_attribute a ON a.attrelid = journal AND a.attnum = k.num ORDER BY k.ord)
            = ARRAY[e.column_name]
          AND ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num, ord)
            JOIN pg_attribute a ON a.attrelid = e.target AND a.attnum = k.num ORDER BY k.ord)
            = ARRAY['id']) <> 2 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_fk_actions';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = journal AND contype NOT IN ('p', 'u', 'f', 'c'))
      OR EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = journal
        AND (NOT i.indisvalid OR NOT i.indisready OR NOT i.indislive OR NOT i.indimmediate
          OR i.indpred IS NOT NULL OR i.indexprs IS NOT NULL OR i.indnatts <> i.indnkeyatts
          OR EXISTS (SELECT 1 FROM unnest(i.indoption::smallint[]) o WHERE o <> 0)
          OR EXISTS (SELECT 1 FROM unnest(i.indclass::oid[], i.indcollation::oid[], i.indkey::smallint[])
              k(opclass_id, collation_id, column_num)
            LEFT JOIN pg_opclass op ON op.oid = k.opclass_id
            LEFT JOIN pg_attribute a ON a.attrelid = journal AND a.attnum = k.column_num
            WHERE NOT coalesce(op.opcdefault AND op.opcintype = a.atttypid
              AND k.collation_id = a.attcollation, false))
          OR position('NULLS NOT DISTINCT' in pg_get_indexdef(i.indexrelid)) > 0)) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_unknown_index_or_constraint';
  END IF;
  SELECT jsonb_agg(jsonb_build_array(c.relname, am.amname, i.indisunique, i.indisprimary,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(num, ord)
        JOIN pg_attribute a ON a.attrelid = journal AND a.attnum = k.num ORDER BY k.ord))
      ORDER BY c.relname) INTO actual_indexes
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_am am ON am.oid = c.relam
    WHERE i.indrelid = journal;
  IF actual_indexes IS DISTINCT FROM wanted_indexes THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_indexes4';
  END IF;

  -- Only the two absent current CHECKs may be added to an otherwise exact
  -- current table. Existing predicates must match the PostgreSQL template.
  FOR item IN SELECT conname, pg_get_expr(conbin, conrelid) AS expression
      FROM pg_constraint WHERE conrelid = 'pg_temp."HappyMIntentExpectedShape18"'::regclass
        AND contype = 'c' ORDER BY conname
  LOOP
    SELECT pg_get_expr(conbin, conrelid) INTO observed_expression
      FROM pg_constraint WHERE conrelid = journal AND conname = item.conname AND contype = 'c';
    IF FOUND THEN
      IF observed_expression IS DISTINCT FROM item.expression THEN
        RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_check_predicate';
      END IF;
    ELSE
      IF item.conname = 'EditorialScheduleIntent_state_check' THEN
        ALTER TABLE public."EditorialScheduleIntent" ADD CONSTRAINT "EditorialScheduleIntent_state_check"
          CHECK ("state" IN ('committed', 'cancelled'));
      ELSE
        ALTER TABLE public."EditorialScheduleIntent" ADD CONSTRAINT "EditorialScheduleIntent_dispatchState_check"
          CHECK ("dispatchState" IN ('pending', 'started', 'cancelled'));
      END IF;
    END IF;
    SELECT pg_get_expr(conbin, conrelid) INTO observed_expression
      FROM pg_constraint WHERE conrelid = journal AND conname = item.conname AND contype = 'c' AND convalidated;
    IF NOT FOUND OR observed_expression IS DISTINCT FROM item.expression THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_unvalidated_check';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = journal AND contype = 'c') <> 2 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_check_count';
  END IF;

  -- The ledger is created/written only after all current journal facts match.
  CREATE TEMP TABLE "HappyMIntentExpectedLedger5" (
    "contract" text NOT NULL,
    "migrationName" text NOT NULL,
    "sourceSqlSha256" text NOT NULL,
    "contractShapeSha256" text NOT NULL,
    "appliedAtUtc" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
  ) ON COMMIT DROP;
  ledger := to_regclass('public."HappyMEngineSchemaLedger"');
  IF ledger IS NULL THEN
    CREATE TABLE public."HappyMEngineSchemaLedger" (
      LIKE pg_temp."HappyMIntentExpectedLedger5" INCLUDING DEFAULTS,
      CONSTRAINT "HappyMEngineSchemaLedger_pkey" PRIMARY KEY ("contract")
    );
    ledger := 'public."HappyMEngineSchemaLedger"'::regclass;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = ledger AND relkind = 'r'
      AND relpersistence = 'p' AND NOT relrowsecurity AND NOT relforcerowsecurity)
      OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = ledger OR inhparent = ledger)
      OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ledger AND NOT tgisinternal)
      OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class = ledger) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_unknown_ledger_kind';
  END IF;
  LOCK TABLE public."HappyMEngineSchemaLedger" IN ACCESS EXCLUSIVE MODE;
  SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
      a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, a.attcollation)
      ORDER BY a.attnum) INTO expected_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'pg_temp."HappyMIntentExpectedLedger5"'::regclass AND a.attnum > 0;
  SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
      a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, a.attcollation)
      ORDER BY a.attnum) INTO actual_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = ledger AND a.attnum > 0;
  IF actual_columns IS DISTINCT FROM expected_columns THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_ledger_columns5';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid = ledger) <> 1
      OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = ledger AND c.contype = 'p'
        AND c.conname = 'HappyMEngineSchemaLedger_pkey' AND NOT c.condeferrable
        AND NOT c.condeferred AND c.convalidated AND c.conislocal AND c.coninhcount = 0
        AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
          JOIN pg_attribute a ON a.attrelid = ledger AND a.attnum = k.num ORDER BY k.ord) = ARRAY['contract'])
      OR (SELECT count(*) FROM pg_index WHERE indrelid = ledger) <> 1
      OR NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_am am ON am.oid = c.relam WHERE i.indrelid = ledger
        AND c.relname = 'HappyMEngineSchemaLedger_pkey' AND am.amname = 'btree'
        AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
        AND i.indnatts = 1 AND i.indnkeyatts = 1 AND i.indpred IS NULL AND i.indexprs IS NULL
        AND NOT EXISTS (SELECT 1 FROM unnest(i.indoption::smallint[]) o WHERE o <> 0)) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_ledger_key';
  END IF;
  IF EXISTS (SELECT 1 FROM public."HappyMEngineSchemaLedger"
      WHERE "contract" = expected_contract AND ("migrationName" <> expected_migration
        OR "sourceSqlSha256" <> expected_source_sha OR "contractShapeSha256" <> expected_shape_sha
        OR NOT isfinite("appliedAtUtc") OR "appliedAtUtc" > clock_timestamp())) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_engine_schema_wrong_ledger_identity';
  END IF;
  SELECT * INTO ledger_row FROM public."HappyMEngineSchemaLedger" WHERE "contract" = expected_contract;
  IF NOT FOUND THEN
    INSERT INTO public."HappyMEngineSchemaLedger"
      ("contract", "migrationName", "sourceSqlSha256", "contractShapeSha256", "appliedAtUtc")
      VALUES (expected_contract, expected_migration, expected_source_sha, expected_shape_sha, clock_timestamp());
  END IF;
  -- A repeat preserves the original DB-clock timestamp and never repairs a
  -- mismatched ledger, unknown FK/index/column or unknown state predicate.
END
$install_current_contract$;
COMMIT;
