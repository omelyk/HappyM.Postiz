/** Fixed public-schema, read-only observations. No identifier comes from HTTP,
 * configuration, search_path or the ledger itself. Missing evidence is held. */
export const activationSchemaContract = 'editorial.schedule-intent/v1';
export const activationMigrationName = '20261018-editorial-schedule-intents-contract';
export const activationSourceSqlSha256 = '2B57DD45A9B619CC52CD88851419DA390F6E8ED2C5979B69D59EEB3F1FDBFA25';
// Root/SQL producer canonical shape JSON (2124 bytes), not an ENV declaration.
export const activationContractShapeSha256: string | null = '910F7713BA87B417BAF122F9290AB9B9956C65FB47A45B8886FB1FB5412C9BB1';

export const ACTIVATION_CATALOG_SQL = `
SELECT pg_catalog.jsonb_build_object(
 'table', (SELECT pg_catalog.jsonb_build_object('kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
   'persistence',c.relpersistence,'inherits',EXISTS(SELECT 1 FROM pg_catalog.pg_inherits h WHERE h.inhrelid=c.oid OR h.inhparent=c.oid),
   'triggers',EXISTS(SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid=c.oid AND NOT g.tgisinternal),
   'rules',EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite w WHERE w.ev_class=c.oid))
   FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='EditorialScheduleIntent'),
 'columns', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',a.attname,'ordinal',a.attnum,
   'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,
   'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,
   'collationDefault',(a.attcollation=0 OR a.attcollation=typ.typcollation)) ORDER BY a.attnum)
   FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class t ON t.oid=a.attrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_type typ ON typ.oid=a.atttypid
   LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE n.nspname='public' AND t.relname='EditorialScheduleIntent' AND a.attnum>0 AND NOT a.attisdropped),'[]'::pg_catalog.jsonb),
 'constraints', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',c.conname,'type',c.contype,
   'valid',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'local',c.conislocal,
   'inherited',c.coninhcount,'noInherit',c.connoinherit,'matchType',c.confmatchtype,
   'columns',(SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.ord) FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum),
   'foreignSchema',rn.nspname,'foreignTable',rt.relname,
   'foreignColumns',(SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.ord) FROM pg_catalog.unnest(c.confkey) WITH ORDINALITY k(attnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum),
   'deleteAction',c.confdeltype,'updateAction',c.confupdtype,
   'expression',pg_catalog.pg_get_expr(c.conbin,c.conrelid)) ORDER BY c.conname)
   FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   LEFT JOIN pg_catalog.pg_class rt ON rt.oid=c.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=rt.relnamespace
   WHERE n.nspname='public' AND t.relname='EditorialScheduleIntent'),'[]'::pg_catalog.jsonb),
 'indexes', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',ix.relname,'unique',i.indisunique,
   'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive,'method',am.amname,
   'included',i.indnatts-i.indnkeyatts,'nullsNotDistinct',i.indnullsnotdistinct,
   'keys',(SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.ord) FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY k(attnum,ord)
      LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE k.ord<=i.indnkeyatts),
   'options',(SELECT pg_catalog.jsonb_agg(v ORDER BY ord) FROM pg_catalog.unnest(i.indoption) WITH ORDINALITY k(v,ord)),
   'operators',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('default',op.opcdefault,
      'typeMatches',op.opcintype=a.atttypid,'collationMatches',i.indcollation[(k.ord-1)::pg_catalog.int4]=a.attcollation) ORDER BY k.ord)
      FROM pg_catalog.unnest(i.indclass) WITH ORDINALITY k(opclass_id,ord)
      LEFT JOIN pg_catalog.pg_opclass op ON op.oid=k.opclass_id LEFT JOIN pg_catalog.pg_attribute a
        ON a.attrelid=i.indrelid AND a.attnum=i.indkey[(k.ord-1)::pg_catalog.int4] WHERE k.ord<=i.indnkeyatts),
   'predicate',pg_catalog.pg_get_expr(i.indpred,i.indrelid),'expression',pg_catalog.pg_get_expr(i.indexprs,i.indrelid)) ORDER BY ix.relname)
   FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
   JOIN pg_catalog.pg_am am ON am.oid=ix.relam WHERE n.nspname='public' AND t.relname='EditorialScheduleIntent'),'[]'::pg_catalog.jsonb),
 'ledgerTable', (SELECT pg_catalog.jsonb_build_object('kind',t.relkind,'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
   'persistence',t.relpersistence,'inherits',EXISTS(SELECT 1 FROM pg_catalog.pg_inherits h WHERE h.inhrelid=t.oid OR h.inhparent=t.oid),
   'triggers',EXISTS(SELECT 1 FROM pg_catalog.pg_trigger g WHERE g.tgrelid=t.oid AND NOT g.tgisinternal),
   'rules',EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite w WHERE w.ev_class=t.oid))
   FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='HappyMEngineSchemaLedger'),
 'ledgerColumns', COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',a.attname,'ordinal',a.attnum,
   'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,
   'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,
   'collationDefault',(a.attcollation=0 OR a.attcollation=typ.typcollation)) ORDER BY a.attnum)
   FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class t ON t.oid=a.attrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_type typ ON typ.oid=a.atttypid
   LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public'
     AND t.relname='HappyMEngineSchemaLedger' AND t.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),'[]'::pg_catalog.jsonb),
 'ledgerKeyValid', (SELECT
   (SELECT count(*) FROM pg_catalog.pg_constraint c WHERE c.conrelid=t.oid)=1
   AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=t.oid AND c.contype='p'
     AND c.conname='HappyMEngineSchemaLedger_pkey' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred
     AND c.conislocal AND c.coninhcount=0 AND
     ARRAY(SELECT a.attname::pg_catalog.text FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY k(num,ord)
       JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord)=ARRAY['contract'])
   AND (SELECT count(*) FROM pg_catalog.pg_index i WHERE i.indrelid=t.oid)=1
   AND EXISTS(SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class x ON x.oid=i.indexrelid
     JOIN pg_catalog.pg_am am ON am.oid=x.relam WHERE i.indrelid=t.oid AND x.relname='HappyMEngineSchemaLedger_pkey'
       AND am.amname='btree' AND i.indisprimary AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
       AND i.indnatts=1 AND i.indnkeyatts=1 AND i.indpred IS NULL AND i.indexprs IS NULL AND NOT i.indnullsnotdistinct
       AND NOT EXISTS(SELECT 1 FROM pg_catalog.unnest(i.indoption) k(v) WHERE v<>0))
   FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname='HappyMEngineSchemaLedger')
) AS observation`;

export const ACTIVATION_LEDGER_SQL = `SELECT "contract", "migrationName", "sourceSqlSha256", "contractShapeSha256",
 (pg_catalog.isfinite("appliedAtUtc") AND "appliedAtUtc"<=pg_catalog.clock_timestamp()) AS "appliedAtValid"
 FROM "public"."HappyMEngineSchemaLedger" WHERE "contract"='editorial.schedule-intent/v1' ORDER BY "contract", "migrationName" LIMIT 3`;

type Row = Record<string, unknown>;
export type ActivationSchemaStatus = {
  contract: typeof activationSchemaContract;
  status: 'Qualified' | 'NotQualified';
  codes: string[];
  ledger: { state: 'NotObserved' | 'Missing' | 'Observed' | 'Mismatch'; migrationName: string; checksumMatches: boolean };
};
const row = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const equal = (actual: unknown, expected: unknown) => JSON.stringify(actual) === JSON.stringify(expected);
const list = (value: unknown, maximum: number): value is Row[] => Array.isArray(value) && value.length <= maximum && value.every(row);
function normalize(value: unknown): unknown {
  if (typeof value !== 'string' || value.length > 2048) return value;
  let result = '';
  for (let i=0; i<value.length; i++) {
    if (value[i] === "'") {
      // Never normalize inside SQL literals: e.g. 'committed::text' and
      // 'comm(itted)' are different values, not casts or grouping syntax.
      result += value[i++]; let closed = false;
      for (; i<value.length; i++) {
        result += value[i];
        if (value[i] === "'") {
          if (value[i+1] === "'") { result += value[++i]; continue; }
          closed = true; break;
        }
      }
      if (!closed) return undefined;
    } else if (value.startsWith('::text',i) && (i+6 === value.length || /[\s),\]]/.test(value[i+6]))) {
      i += 5;
    } else if (!/[\s()"]/.test(value[i])) result += value[i];
  }
  return result;
}
const first = (values: Row[], name: string) => values.filter(value => value.name === name);
const one = (values: Row[], name: string) => first(values, name).length === 1 ? first(values, name)[0] : null;

export function notQualified(codes: string[], state: 'NotObserved' | 'Missing' | 'Mismatch' = 'NotObserved'): ActivationSchemaStatus {
  return { contract: activationSchemaContract, status: 'NotQualified', codes,
    ledger: { state, migrationName: activationMigrationName, checksumMatches: false } };
}
export function validProbeNonce(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

/** Catalog shape must be checked before querying a possibly absent ledger. */
export function canReadActivationLedger(catalogRows: unknown): boolean {
  const value = observation(catalogRows);
  if (!value || !row(value.ledgerTable) || value.ledgerTable.kind !== 'r'
    || value.ledgerTable.rls !== false || value.ledgerTable.forceRls !== false || value.ledgerTable.persistence !== 'p'
    || value.ledgerTable.inherits !== false || value.ledgerTable.triggers !== false || value.ledgerTable.rules !== false
    || value.ledgerKeyValid !== true || !list(value.ledgerColumns, 16) || value.ledgerColumns.length !== 5) return false;
  const columns = value.ledgerColumns;
  const expected = ['contract', 'migrationName', 'sourceSqlSha256', 'contractShapeSha256'];
  return expected.every((name,index) => {
    const column = one(columns, name);
    return column?.type === 'text' && column.ordinal === index+1 && columns[index].name === name
      && column.nullable === false && column.default === null
      && column.identity === '' && column.generated === '' && column.collationDefault === true;
  }) && (() => {
    const applied = one(columns, 'appliedAtUtc');
    return applied?.type === 'timestamp with time zone' && applied.ordinal === 5 && columns[4].name === 'appliedAtUtc' && applied.nullable === false
      && normalize(applied.default) === 'clock_timestamp' && applied.identity === ''
      && applied.generated === '' && applied.collationDefault === true;
  })();
}
function observation(catalogRows: unknown): Row | null {
  if (!Array.isArray(catalogRows) || catalogRows.length !== 1 || !row(catalogRows[0]) || !row(catalogRows[0].observation)) return null;
  const value = catalogRows[0].observation;
  try { if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32768) return null; } catch { return null; }
  return value;
}

/** Pure strict observation parser; fixture data is never runtime/native proof. */
export function evaluateActivationSchema(catalogRows: unknown, ledgerRows: unknown,
  expectedShapeSha256: string | null = activationContractShapeSha256): ActivationSchemaStatus {
  const value = observation(catalogRows);
  if (!value || !row(value.table) || value.table.kind !== 'r' || value.table.rls !== false || value.table.forceRls !== false
    || value.table.persistence !== 'p' || value.table.inherits !== false || value.table.triggers !== false || value.table.rules !== false)
    return notQualified(['schema_table_missing_or_unsupported']);
  if (!list(value.columns, 64) || !list(value.constraints, 32) || !list(value.indexes, 32))
    return notQualified(['schema_observation_invalid']);
  const columns = value.columns;
  const expectedColumns: Array<[string, string, boolean, string | null]> = [
    ['organizationId','text',false,null], ['intentId','text',false,null], ['payloadHash','text',false,null],
    ['payloadJson','text',false,null], ['commandId','text',false,null], ['crmOccurrenceId','text',false,null],
    ['revisionId','text',false,null], ['bindingKey','text',false,null], ['postId','text',true,null],
    ['state','text',false,"'committed'"], ['linksJson','text',false,null], ['dispatchState','text',false,"'pending'"],
    ['dispatchLeaseOwner','text',true,null], ['dispatchLeaseExpiresAt','timestamp(3) without time zone',true,null],
    ['dispatchFence','integer',false,'0'], ['dispatchedAt','timestamp(3) without time zone',true,null],
    ['createdAt','timestamp(3) without time zone',false,'CURRENT_TIMESTAMP'], ['updatedAt','timestamp(3) without time zone',false,null],
  ];
  if (columns.length !== expectedColumns.length || !expectedColumns.every(([name,type,nullable,defaultValue],index) => {
    const column = one(columns, name);
    return column && column.ordinal === index+1 && columns[index].name === name && column.type === type
      && column.nullable === nullable && normalize(column.default) === defaultValue
      && column.identity === '' && column.generated === '' && column.collationDefault === true;
  })) return notQualified(['schema_columns_mismatch']);
  const constraints = value.constraints;
  if (![5,6].includes(constraints.length) || constraints.some(c => c.valid !== true || c.deferrable !== false || c.deferred !== false
    || c.local !== true || c.inherited !== 0 || c.type === 'c' && c.noInherit !== false))
    return notQualified(['schema_constraints_mismatch']);
  const basic = (name: string, type: string, keys: string[]) => {
    const c = one(constraints, name); return c && c.type === type && equal(c.columns, keys) && c.expression === null;
  };
  // PostgreSQL UNIQUE constraint and Prisma's standalone unique index enforce
  // the same current contract. Both must pass the exact four-index facts below.
  const unique = constraints.filter(c => c.type === 'u');
  if (!basic('EditorialScheduleIntent_pkey','p',['organizationId','intentId'])
    || (constraints.length === 5 ? unique.length !== 0
      : unique.length !== 1 || !basic('EditorialScheduleIntent_postId_key','u',['postId'])))
    return notQualified(['schema_constraints_mismatch']);
  for (const [column,table] of [['organizationId','Organization'],['postId','Post']]) {
    const c = one(constraints, `EditorialScheduleIntent_${column}_fkey`);
    if (!c || c.type !== 'f' || !equal(c.columns,[column]) || c.foreignSchema !== 'public' || c.foreignTable !== table
      || !equal(c.foreignColumns,['id']) || c.deleteAction !== 'a' || c.updateAction !== 'a' || c.matchType !== 's' || c.expression !== null)
      return notQualified(['schema_foreign_keys_mismatch']);
  }
  for (const [name,expression] of [
    ['state', "state=ANYARRAY['committed','cancelled']"],
    ['dispatchState', "dispatchState=ANYARRAY['pending','started','cancelled']"],
  ]) {
    const c = one(constraints, `EditorialScheduleIntent_${name}_check`);
    if (!c || c.type !== 'c' || !equal(c.columns,[name]) || normalize(c.expression) !== expression)
      return notQualified(['schema_checks_mismatch']);
  }
  const expectedIndexes: Array<[string,boolean,boolean,string[]]> = [
    ['EditorialScheduleIntent_pkey',true,true,['organizationId','intentId']],
    ['EditorialScheduleIntent_postId_key',true,false,['postId']],
    ['EditorialScheduleIntent_state_dispatchState_lease_created_idx',false,false,['state','dispatchState','dispatchLeaseExpiresAt','createdAt']],
    ['EditorialScheduleIntent_organizationId_commandId_idx',false,false,['organizationId','commandId']],
  ];
  if (value.indexes.length !== 4 || !expectedIndexes.every(([name,unique,primary,keys]) => {
    const i = one(value.indexes as Row[], name);
    return i && i.unique === unique && i.primary === primary && equal(i.keys,keys)
      && i.valid === true && i.ready === true && i.live === true && i.method === 'btree' && i.included === 0 && i.nullsNotDistinct === false
      && equal(i.options, keys.map(() => 0))
      && list(i.operators, keys.length) && i.operators.length === keys.length
      && i.operators.every(op => Object.keys(op).length === 3 && op.default === true && op.typeMatches === true && op.collationMatches === true)
      && i.predicate === null && i.expression === null;
  })) return notQualified(['schema_indexes_mismatch']);
  if (!canReadActivationLedger(catalogRows)) return notQualified(['schema_ledger_missing_or_unsupported'], value.ledgerTable === null ? 'Missing' : 'Mismatch');
  if (!list(ledgerRows, 3) || ledgerRows.length !== 1) return notQualified(['schema_ledger_mismatch'], 'Mismatch');
  const ledger = ledgerRows[0];
  if (!expectedShapeSha256 || !/^[a-fA-F0-9]{64}$/.test(expectedShapeSha256))
    return notQualified(['schema_contract_pin_unqualified'], 'Mismatch');
  if (ledger.contract !== activationSchemaContract || ledger.migrationName !== activationMigrationName
    || ledger.sourceSqlSha256 !== activationSourceSqlSha256 || ledger.contractShapeSha256 !== expectedShapeSha256 || ledger.appliedAtValid !== true)
    return notQualified(['schema_ledger_mismatch'], 'Mismatch');
  return { contract: activationSchemaContract, status: 'Qualified', codes: [],
    ledger: { state: 'Observed', migrationName: activationMigrationName, checksumMatches: true } };
}
