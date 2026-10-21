-- SOURCE ONLY. Root owns execution; no deployment or runtime qualification is claimed.
-- HAPPYM_SYNTHETIC_SHAPE_V1_BEGIN
-- {"version":"happym.editorial-synthetic-delivery.pg-shape/v1","contract":"editorial.synthetic-delivery/v1","wireContract":"happym.synthetic-delivery/v1","enums":[["public.State",["QUEUE","PUBLISHED","ERROR","DRAFT","SIMULATED"]],["public.PrePublishRenderStatus",["SCHEDULED","AWAITING_RENDER","READY_TO_PUBLISH","PUBLISHING","PUBLISHED","FAILED","RENDER_TIMED_OUT","CANCELLED","SIMULATED"]]],"tables":[{"table":"public.SyntheticDeliveryReceipt","columns":[["scopeKey","character(64)",false,null],["slideIndex","integer",false,null],["clientId","text",false,null],["environmentId","text",false,null],["deploymentId","text",false,null],["installationId","text",false,null],["organizationId","text",false,null],["integrationId","text",false,null],["postId","text",false,null],["occurrenceId","text",false,null],["bodyHash","character(64)",false,null],["syntheticReceiptId","text",false,null],["createdAt","timestamp(3) without time zone",false,"CURRENT_TIMESTAMP"]],"primaryKey":["scopeKey","slideIndex"],"unique":[["syntheticReceiptId"]],"foreignKeys":[["occurrenceId","public.PrePublishRenderOccurrence","id","NO ACTION","NO ACTION"]],"indexes":[["SyntheticDeliveryReceipt_organizationId_postId_occurrenceId_idx",false,["organizationId","postId","occurrenceId"]],["SyntheticDeliveryReceipt_pkey",true,["scopeKey","slideIndex"]],["SyntheticDeliveryReceipt_syntheticReceiptId_key",true,["syntheticReceiptId"]]]},{"table":"public.SyntheticDeliveryEvent","columns":[["scopeKey","character(64)",false,null],["ordinal","integer",false,null],["clientId","text",false,null],["environmentId","text",false,null],["deploymentId","text",false,null],["installationId","text",false,null],["organizationId","text",false,null],["integrationId","text",false,null],["postId","text",false,null],["occurrenceId","text",false,null],["bodyHash","character(64)",false,null],["kind","text",false,null],["slideIndex","integer",true,null],["createdAt","timestamp(3) without time zone",false,"CURRENT_TIMESTAMP"]],"primaryKey":["scopeKey","ordinal"],"unique":[],"foreignKeys":[["occurrenceId","public.PrePublishRenderOccurrence","id","NO ACTION","NO ACTION"]],"indexes":[["SyntheticDeliveryEvent_organizationId_postId_occurrenceId_idx",false,["organizationId","postId","occurrenceId"]],["SyntheticDeliveryEvent_pkey",true,["scopeKey","ordinal"]]]}],"ledger":{"table":"public.HappyMEngineSchemaLedger","columns":[["contract","text",false,null],["migrationName","text",false,null],["sourceSqlSha256","text",false,null],["contractShapeSha256","text",false,null],["appliedAtUtc","timestamp with time zone",false,"clock_timestamp()"]],"primaryKey":["contract"],"migrationName":"20261018-editorial-synthetic-delivery-contract","sourceSqlSha256":"8B5A0AF0ACB6735414C10D4D40D7090360F363B81162F1A93485D0DF6012A86C","sourceSqlHashDefinition":"UTF8 exact HAPPYM_SYNTHETIC_DDL_V1 block excluding marker lines; LF including final LF"}}
-- HAPPYM_SYNTHETIC_SHAPE_V1_END
-- sourceSqlSha256 hashes only the DDL block below, excluding marker lines,
-- UTF-8, LF line endings, including the LF after its final statement.
-- The full file SHA belongs to the separately pinned Root install artifact.

BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $install_synthetic_contract$
DECLARE
  expected_contract CONSTANT text := 'editorial.synthetic-delivery/v1';
  expected_migration CONSTANT text := '20261018-editorial-synthetic-delivery-contract';
  expected_source_sha CONSTANT text := '8B5A0AF0ACB6735414C10D4D40D7090360F363B81162F1A93485D0DF6012A86C';
  expected_shape_sha CONSTANT text := '2A7130D0492790C7DF34CDD74589A2B1CF4142708E557C26362A26438B2A240C';
  canonical_ddl CONSTANT text := $happym_canonical_ddl$
-- HAPPYM_SYNTHETIC_DDL_V1_BEGIN
ALTER TYPE public."State" ADD VALUE 'SIMULATED';
-- HAPPYM_DDL_SPLIT
ALTER TYPE public."PrePublishRenderStatus" ADD VALUE 'SIMULATED';
-- HAPPYM_DDL_SPLIT
CREATE TABLE public."SyntheticDeliveryReceipt" (
    "scopeKey" character(64) NOT NULL,
    "slideIndex" integer NOT NULL,
    "clientId" text NOT NULL,
    "environmentId" text NOT NULL,
    "deploymentId" text NOT NULL,
    "installationId" text NOT NULL,
    "organizationId" text NOT NULL,
    "integrationId" text NOT NULL,
    "postId" text NOT NULL,
    "occurrenceId" text NOT NULL,
    "bodyHash" character(64) NOT NULL,
    "syntheticReceiptId" text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyntheticDeliveryReceipt_pkey" PRIMARY KEY ("scopeKey", "slideIndex"),
    CONSTRAINT "SyntheticDeliveryReceipt_syntheticReceiptId_key" UNIQUE ("syntheticReceiptId"),
    CONSTRAINT "SyntheticDeliveryReceipt_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES public."PrePublishRenderOccurrence"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "SyntheticDeliveryReceipt_organizationId_postId_occurrenceId_idx" ON public."SyntheticDeliveryReceipt" ("organizationId", "postId", "occurrenceId");
-- HAPPYM_DDL_SPLIT
CREATE TABLE public."SyntheticDeliveryEvent" (
    "scopeKey" character(64) NOT NULL,
    "ordinal" integer NOT NULL,
    "clientId" text NOT NULL,
    "environmentId" text NOT NULL,
    "deploymentId" text NOT NULL,
    "installationId" text NOT NULL,
    "organizationId" text NOT NULL,
    "integrationId" text NOT NULL,
    "postId" text NOT NULL,
    "occurrenceId" text NOT NULL,
    "bodyHash" character(64) NOT NULL,
    "kind" text NOT NULL,
    "slideIndex" integer,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyntheticDeliveryEvent_pkey" PRIMARY KEY ("scopeKey", "ordinal"),
    CONSTRAINT "SyntheticDeliveryEvent_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES public."PrePublishRenderOccurrence"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "SyntheticDeliveryEvent_organizationId_postId_occurrenceId_idx" ON public."SyntheticDeliveryEvent" ("organizationId", "postId", "occurrenceId");
-- HAPPYM_SYNTHETIC_DDL_V1_END
$happym_canonical_ddl$;
  canonical_ddl_lf text := replace(canonical_ddl, E'\r\n', E'\n');
  ddl_statements text[] := string_to_array(canonical_ddl_lf, E'\n-- HAPPYM_DDL_SPLIT\n');
  expected_state_labels CONSTANT text[] := ARRAY['QUEUE','PUBLISHED','ERROR','DRAFT','SIMULATED'];
  expected_render_labels CONSTANT text[] := ARRAY['SCHEDULED','AWAITING_RENDER','READY_TO_PUBLISH','PUBLISHING','PUBLISHED','FAILED','RENDER_TIMED_OUT','CANCELLED','SIMULATED'];
  expected_tables CONSTANT jsonb := '[{"name":"SyntheticDeliveryReceipt","temporary":"HappyMSyntheticExpected0","ddlIndex":3,"primaryKey":["scopeKey","slideIndex"],"unique":[["syntheticReceiptId"]],"indexes":[["SyntheticDeliveryReceipt_organizationId_postId_occurrenceId_idx","btree",false,false,["organizationId","postId","occurrenceId"]],["SyntheticDeliveryReceipt_pkey","btree",true,true,["scopeKey","slideIndex"]],["SyntheticDeliveryReceipt_syntheticReceiptId_key","btree",true,false,["syntheticReceiptId"]]]},{"name":"SyntheticDeliveryEvent","temporary":"HappyMSyntheticExpected1","ddlIndex":4,"primaryKey":["scopeKey","ordinal"],"unique":[],"indexes":[["SyntheticDeliveryEvent_organizationId_postId_occurrenceId_idx","btree",false,false,["organizationId","postId","occurrenceId"]],["SyntheticDeliveryEvent_pkey","btree",true,true,["scopeKey","ordinal"]]]}]'::jsonb;
  ledger regclass;
  relation regclass;
  temporary_relation regclass;
  expected_columns jsonb;
  actual_columns jsonb;
  actual_indexes jsonb;
  actual_labels text[];
  own_recorded boolean := false;
  item record;
  spec jsonb;
  ledger_row record;
BEGIN
  IF cardinality(ddl_statements) <> 4 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_invalid_ddl_fragments';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('happym.engine.current-schema-ledger', 0));
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('Organization','Post','Integration','PrePublishRenderOccurrence')
        AND c.relkind = 'r' AND c.relpersistence = 'p') <> 4 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_missing_base';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid IN ('public."Organization"'::regclass,
      'public."Post"'::regclass, 'public."Integration"'::regclass, 'public."PrePublishRenderOccurrence"'::regclass)
      AND attname = 'id' AND attnum > 0 AND NOT attisdropped AND atttypid = 'text'::regtype AND attnotnull) <> 4 THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_base_id';
  END IF;
  ledger := to_regclass('public."HappyMEngineSchemaLedger"');
  IF ledger IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public."HappyMEngineSchemaLedger" WHERE "contract" = expected_contract) INTO own_recorded;
  END IF;
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO actual_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' AND t.typname='State';
  IF actual_labels = expected_state_labels[1:4] AND NOT own_recorded THEN
    EXECUTE ddl_statements[1];
  ELSIF actual_labels IS DISTINCT FROM expected_state_labels THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unknown_post_enum';
  END IF;
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO actual_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' AND t.typname='PrePublishRenderStatus';
  IF actual_labels = expected_render_labels[1:8] AND NOT own_recorded THEN
    EXECUTE ddl_statements[2];
  ELSIF actual_labels IS DISTINCT FROM expected_render_labels THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unknown_render_enum';
  END IF;
  CREATE TEMP TABLE "HappyMSyntheticExpected0" (
    "scopeKey" character(64) NOT NULL,
    "slideIndex" integer NOT NULL,
    "clientId" text NOT NULL,
    "environmentId" text NOT NULL,
    "deploymentId" text NOT NULL,
    "installationId" text NOT NULL,
    "organizationId" text NOT NULL,
    "integrationId" text NOT NULL,
    "postId" text NOT NULL,
    "occurrenceId" text NOT NULL,
    "bodyHash" character(64) NOT NULL,
    "syntheticReceiptId" text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ON COMMIT DROP;
  CREATE TEMP TABLE "HappyMSyntheticExpected1" (
    "scopeKey" character(64) NOT NULL,
    "ordinal" integer NOT NULL,
    "clientId" text NOT NULL,
    "environmentId" text NOT NULL,
    "deploymentId" text NOT NULL,
    "installationId" text NOT NULL,
    "organizationId" text NOT NULL,
    "integrationId" text NOT NULL,
    "postId" text NOT NULL,
    "occurrenceId" text NOT NULL,
    "bodyHash" character(64) NOT NULL,
    "kind" text NOT NULL,
    "slideIndex" integer,
    "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ON COMMIT DROP;
  FOR spec IN SELECT value FROM jsonb_array_elements(expected_tables)
  LOOP
    relation := to_regclass(format('public.%I', spec->>'name'));
    IF relation IS NULL THEN
      IF own_recorded THEN
        RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_recorded_table_missing';
      END IF;
      EXECUTE ddl_statements[(spec->>'ddlIndex')::integer];
      relation := to_regclass(format('public.%I', spec->>'name'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = relation AND relkind='r' AND relpersistence='p'
        AND NOT relrowsecurity AND NOT relforcerowsecurity)
        OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid=relation OR inhparent=relation)
        OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=relation AND NOT tgisinternal)
        OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class=relation) THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unknown_table_kind';
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', spec->>'name');
    temporary_relation := to_regclass(format('pg_temp.%I',spec->>'temporary'));
    SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
        pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attcollation) ORDER BY a.attnum)
      INTO expected_columns FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=temporary_relation AND a.attnum>0;
    SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
        pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,a.attcollation) ORDER BY a.attnum)
      INTO actual_columns FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=relation AND a.attnum>0;
    IF actual_columns IS DISTINCT FROM expected_columns THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_columns';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid=relation AND
        (c.contype NOT IN ('p','u','f') OR c.condeferrable OR c.condeferred OR NOT c.convalidated
          OR NOT c.conislocal OR c.coninhcount<>0)) THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unknown_constraint';
    END IF;
    IF (SELECT count(*) FROM pg_constraint WHERE conrelid=relation AND contype='p')<>1
        OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid=relation AND c.contype='p'
          AND c.conname=(spec->>'name')||'_pkey'
          AND to_jsonb(ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
            JOIN pg_attribute a ON a.attrelid=relation AND a.attnum=k.num ORDER BY k.ord))=spec->'primaryKey') THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_primary_key';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid=relation AND c.contype='u' AND
        ((spec->>'name')<>'SyntheticDeliveryReceipt' OR c.conname<>'SyntheticDeliveryReceipt_syntheticReceiptId_key'
          OR ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
            JOIN pg_attribute a ON a.attrelid=relation AND a.attnum=k.num ORDER BY k.ord)<>ARRAY['syntheticReceiptId'])) THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_unique_constraint';
    END IF;
    IF (SELECT count(*) FROM pg_constraint WHERE conrelid=relation AND contype='f')<>1
        OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid=relation AND c.contype='f'
          AND c.conname=(spec->>'name')||'_occurrenceId_fkey'
          AND c.confrelid='public."PrePublishRenderOccurrence"'::regclass
          AND c.confdeltype='a' AND c.confupdtype='a' AND c.confmatchtype='s'
          AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
            JOIN pg_attribute a ON a.attrelid=relation AND a.attnum=k.num ORDER BY k.ord)=ARRAY['occurrenceId']
          AND ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
            JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord)=ARRAY['id']) THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_foreign_key';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=relation AND
        (NOT i.indisvalid OR NOT i.indisready OR NOT i.indislive OR NOT i.indimmediate
          OR i.indpred IS NOT NULL OR i.indexprs IS NOT NULL OR i.indnatts<>i.indnkeyatts
          OR EXISTS (SELECT 1 FROM unnest(i.indoption::smallint[]) o WHERE o<>0)
          OR position('NULLS NOT DISTINCT' in pg_get_indexdef(i.indexrelid))>0
          OR EXISTS (SELECT 1 FROM unnest(i.indclass::oid[],i.indcollation::oid[],i.indkey::smallint[]) k(opclass_id,collation_id,column_num)
            LEFT JOIN pg_opclass op ON op.oid=k.opclass_id LEFT JOIN pg_attribute a ON a.attrelid=relation AND a.attnum=k.column_num
            WHERE NOT coalesce(op.opcdefault AND op.opcintype=a.atttypid AND k.collation_id=a.attcollation,false)))) THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unknown_index';
    END IF;
    SELECT jsonb_agg(jsonb_build_array(c.relname,am.amname,i.indisunique,i.indisprimary,
        ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=relation AND a.attnum=k.num ORDER BY k.ord)) ORDER BY c.relname)
      INTO actual_indexes FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam
      WHERE i.indrelid=relation;
    IF actual_indexes IS DISTINCT FROM spec->'indexes' THEN
      RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_indexes';
    END IF;
  END LOOP;
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO actual_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' AND t.typname='State';
  IF actual_labels IS DISTINCT FROM expected_state_labels THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unconfirmed_post_enum';
  END IF;
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO actual_labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' AND t.typname='PrePublishRenderStatus';
  IF actual_labels IS DISTINCT FROM expected_render_labels THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unconfirmed_render_enum';
  END IF;
  -- Ledger facts and current component row only, after both tables and enums match.
  CREATE TEMP TABLE "HappyMSyntheticExpectedLedger5" (
    "contract" text NOT NULL,
    "migrationName" text NOT NULL,
    "sourceSqlSha256" text NOT NULL,
    "contractShapeSha256" text NOT NULL,
    "appliedAtUtc" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
  ) ON COMMIT DROP;
  ledger := to_regclass('public."HappyMEngineSchemaLedger"');
  IF ledger IS NULL THEN
    CREATE TABLE public."HappyMEngineSchemaLedger" (
      LIKE pg_temp."HappyMSyntheticExpectedLedger5" INCLUDING DEFAULTS,
      CONSTRAINT "HappyMEngineSchemaLedger_pkey" PRIMARY KEY ("contract")
    );
    ledger := 'public."HappyMEngineSchemaLedger"'::regclass;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = ledger AND relkind = 'r'
      AND relpersistence = 'p' AND NOT relrowsecurity AND NOT relforcerowsecurity)
      OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = ledger OR inhparent = ledger)
      OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ledger AND NOT tgisinternal)
      OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class = ledger) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_unknown_ledger_kind';
  END IF;
  LOCK TABLE public."HappyMEngineSchemaLedger" IN ACCESS EXCLUSIVE MODE;
  SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
      a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, a.attcollation)
      ORDER BY a.attnum) INTO expected_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'pg_temp."HappyMSyntheticExpectedLedger5"'::regclass AND a.attnum > 0;
  SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
      a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, a.attcollation)
      ORDER BY a.attnum) INTO actual_columns
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = ledger AND a.attnum > 0;
  IF actual_columns IS DISTINCT FROM expected_columns THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_ledger_columns5';
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
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_ledger_key';
  END IF;
  IF EXISTS (SELECT 1 FROM public."HappyMEngineSchemaLedger"
      WHERE "contract" = expected_contract AND ("migrationName" <> expected_migration
        OR "sourceSqlSha256" <> expected_source_sha OR "contractShapeSha256" <> expected_shape_sha
        OR NOT isfinite("appliedAtUtc") OR "appliedAtUtc" > clock_timestamp())) THEN
    RAISE EXCEPTION USING MESSAGE = 'happym_synthetic_schema_wrong_ledger_identity';
  END IF;
  SELECT * INTO ledger_row FROM public."HappyMEngineSchemaLedger" WHERE "contract" = expected_contract;
  IF NOT FOUND THEN
    INSERT INTO public."HappyMEngineSchemaLedger"
      ("contract", "migrationName", "sourceSqlSha256", "contractShapeSha256", "appliedAtUtc")
      VALUES (expected_contract, expected_migration, expected_source_sha, expected_shape_sha, clock_timestamp());
  END IF;
END
$install_synthetic_contract$;
COMMIT;
