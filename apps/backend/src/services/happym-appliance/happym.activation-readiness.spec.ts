import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { HappyMActivationReadinessService } from './happym.activation-readiness.service';
import {
  ACTIVATION_CATALOG_SQL, ACTIVATION_LEDGER_SQL, activationContractShapeSha256, activationMigrationName,
  activationSchemaContract, activationSourceSqlSha256, canReadActivationLedger,
  evaluateActivationSchema, validProbeNonce,
} from './happym.activation-schema';

// Independent data fixture of the frozen manual18-column SQL contract, not an
// actual PostgreSQL observation, native/image proof or positive activation.
const shapeHash = 'A'.repeat(64);
function fixture() {
  const text = ['organizationId','intentId','payloadHash','payloadJson','commandId','crmOccurrenceId',
    'revisionId','bindingKey','postId','state','linksJson','dispatchState','dispatchLeaseOwner'];
  const columns = text.map(name => ({ name, type: 'text', nullable: ['postId','dispatchLeaseOwner'].includes(name),
    default: name === 'state' ? "'committed'::text" : name === 'dispatchState' ? "'pending'::text" : null,
    identity: '', generated: '', collationDefault: true }));
  for (const name of ['dispatchLeaseExpiresAt','dispatchedAt','createdAt','updatedAt'])
    columns.push({ name, type: 'timestamp(3) without time zone', nullable: ['dispatchLeaseExpiresAt','dispatchedAt'].includes(name),
      default: name === 'createdAt' ? 'CURRENT_TIMESTAMP' : null, identity: '', generated: '', collationDefault: true });
  columns.push({ name: 'dispatchFence', type: 'integer', nullable: false, default: '0', identity: '', generated: '', collationDefault: true });
  const order = ['organizationId','intentId','payloadHash','payloadJson','commandId','crmOccurrenceId','revisionId','bindingKey',
    'postId','state','linksJson','dispatchState','dispatchLeaseOwner','dispatchLeaseExpiresAt','dispatchFence','dispatchedAt','createdAt','updatedAt'];
  const orderedColumns = order.map((name,index) => ({ ...columns.find(column => column.name === name)!, ordinal: index+1 }));
  const constraint = (name: string, type: string, keys: string[]) => ({ name, type, columns: keys,
    valid: true, deferrable: false, deferred: false, local: true, inherited: 0, noInherit: false, matchType: 's', expression: null as string | null,
    foreignSchema: null as string | null, foreignTable: null as string | null, foreignColumns: null as string[] | null,
    deleteAction: ' ', updateAction: ' ' });
  const constraints = [constraint('EditorialScheduleIntent_pkey','p',['organizationId','intentId']),
    constraint('EditorialScheduleIntent_postId_key','u',['postId'])];
  for (const [column,table] of [['organizationId','Organization'],['postId','Post']]) constraints.push({
    ...constraint(`EditorialScheduleIntent_${column}_fkey`,'f',[column]), foreignSchema: 'public', foreignTable: table,
    foreignColumns: ['id'], deleteAction: 'a', updateAction: 'a',
  });
  constraints.push({ ...constraint('EditorialScheduleIntent_state_check','c',['state']),
    expression: "(state = ANY (ARRAY['committed'::text, 'cancelled'::text]))" });
  constraints.push({ ...constraint('EditorialScheduleIntent_dispatchState_check','c',['dispatchState']),
    expression: "(\"dispatchState\" = ANY (ARRAY['pending'::text, 'started'::text, 'cancelled'::text]))" });
  const index = (name: string, unique: boolean, primary: boolean, keys: string[]) => ({
    name, unique, primary, keys, valid: true, ready: true, live: true, method: 'btree', included: 0,
    options: keys.map(() => 0), nullsNotDistinct: false, predicate: null as string | null, expression: null as string | null,
    operators: keys.map(() => ({ default: true, typeMatches: true, collationMatches: true })),
  });
  return [{ observation: {
    table: { kind: 'r', rls: false, forceRls: false, persistence: 'p', inherits: false, triggers: false, rules: false }, columns: orderedColumns, constraints,
    indexes: [index('EditorialScheduleIntent_pkey',true,true,['organizationId','intentId']),
      index('EditorialScheduleIntent_postId_key',true,false,['postId']),
      index('EditorialScheduleIntent_state_dispatchState_lease_created_idx',false,false,['state','dispatchState','dispatchLeaseExpiresAt','createdAt']),
      index('EditorialScheduleIntent_organizationId_commandId_idx',false,false,['organizationId','commandId'])],
    ledgerTable: { kind: 'r', rls: false, forceRls: false, persistence: 'p', inherits: false, triggers: false, rules: false },
    ledgerKeyValid: true,
    ledgerColumns: [...['contract','migrationName','sourceSqlSha256','contractShapeSha256'].map((name,index) => ({ name,
      ordinal: index+1, type: 'text', nullable: false, default: null as string | null, identity: '', generated: '', collationDefault: true })),
      { name: 'appliedAtUtc', ordinal: 5, type: 'timestamp with time zone', nullable: false,
        default: 'clock_timestamp()', identity: '', generated: '', collationDefault: true }],
  } }];
}
const ledger = () => [{ contract: activationSchemaContract, migrationName: activationMigrationName,
  sourceSqlSha256: activationSourceSqlSha256, contractShapeSha256: shapeHash, appliedAtValid: true }];

describe('actual activation catalog parser, source-prepared only', () => {
  it('accepts only complete catalog/ledger data against an independently pinned expected digest', () => {
    const result = evaluateActivationSchema(fixture(), ledger(), shapeHash);
    expect(result.status).toBe('Qualified');
    expect(result.ledger.state).toBe('Observed');
    // This is pure parser data; neither service nor test mints native activation.
  });
  it('accepts exact Prisma standalone postId uniqueness without a redundant UNIQUE constraint', () => {
    const rows = fixture();
    rows[0].observation.constraints = rows[0].observation.constraints.filter(c => c.type !== 'u');
    expect(evaluateActivationSchema(rows, ledger(), shapeHash).status).toBe('Qualified');
  });
  it.each(['missing-unique-index','invalid-unique-index','unknown-constraint'])(
    'keeps standalone uniqueness fail-closed on %s', mutation => {
      const rows = fixture(); const o = rows[0].observation;
      o.constraints = o.constraints.filter(c => c.type !== 'u');
      if (mutation === 'missing-unique-index') o.indexes = o.indexes.filter(i => i.name !== 'EditorialScheduleIntent_postId_key');
      if (mutation === 'invalid-unique-index') o.indexes[1].unique = false;
      if (mutation === 'unknown-constraint') o.constraints.push({ ...o.constraints[0], name: 'unknown', type: 'u' });
      expect(evaluateActivationSchema(rows, ledger(), shapeHash).status).toBe('NotQualified');
    });
  it('scopes the ledger query to its exact contract and rejects unfiltered foreign-contract data', () => {
    const core = ledger();
    const synthetic = { ...core[0], contract: 'editorial.synthetic-delivery/v1' };
    expect(ACTIVATION_LEDGER_SQL).toContain(`WHERE "contract"='editorial.schedule-intent/v1'`);
    expect(ACTIVATION_LEDGER_SQL).toContain('LIMIT 3');
    // A shared DB can contain both independent contracts. The fixed SQL returns
    // only core; the parser must not silently select a row from unfiltered input.
    expect(evaluateActivationSchema(fixture(), core, shapeHash).status).toBe('Qualified');
    expect(evaluateActivationSchema(fixture(), [...core, synthetic], shapeHash).status).toBe('NotQualified');
    expect(evaluateActivationSchema(fixture(), [synthetic], shapeHash).status).toBe('NotQualified');
  });
  it.each(['', 'a'.repeat(63), 'A'.repeat(64), 'a'.repeat(65), ['a'.repeat(64)], null])(
    'rejects a malformed nonce without accepting arrays or alternate encodings: %p', value => {
      expect(validProbeNonce(value)).toBe(false);
    });
  it('accepts exact lowercase64hex nonce', () => expect(validProbeNonce('a'.repeat(64))).toBe(true));
  it.each(['missing-column','extra-column','wrong-type','nullable','default','identity','collation','table-rls','table-unlogged',
    'missing-check','unvalidated-check','check-expression','foreign-delete','foreign-schema','index-key','index-filter','index-desc','index-invalid'])
    ('holds every incompatible actual schema shape: %s', mutation => {
      const rows = fixture(); const o = rows[0].observation;
      switch (mutation) {
        case 'missing-column': o.columns.pop(); break;
        case 'extra-column': o.columns.push({ ...o.columns[0], name: 'unknown' }); break;
        case 'wrong-type': o.columns[0].type = 'citext'; break;
        case 'nullable': o.columns[0].nullable = true; break;
        case 'default': o.columns[0].default = "'invented'"; break;
        case 'identity': o.columns[0].identity = 'a'; break;
        case 'collation': o.columns[0].collationDefault = false; break;
        case 'table-rls': o.table.rls = true; break;
        case 'table-unlogged': o.table.persistence = 'u'; break;
        case 'missing-check': o.constraints.pop(); break;
        case 'unvalidated-check': o.constraints[4].valid = false; break;
        case 'check-expression': o.constraints[4].expression = 'true'; break;
        case 'foreign-delete': o.constraints[2].deleteAction = 'c'; break;
        case 'foreign-schema': o.constraints[2].foreignSchema = 'foreign'; break;
        case 'index-key': o.indexes[2].keys.reverse(); break;
        case 'index-filter': o.indexes[2].predicate = 'true'; break;
        case 'index-desc': o.indexes[2].options[0] = 1; break;
        case 'index-invalid': o.indexes[2].valid = false; break;
      }
      expect(evaluateActivationSchema(rows, ledger(), shapeHash).status).toBe('NotQualified');
    });
  it('does not manufacture a ledger from db-push-created columns or from a Prisma history table', () => {
    const rows = fixture();
    rows[0].observation.ledgerTable = null!; rows[0].observation.ledgerColumns = [];
    expect(canReadActivationLedger(rows)).toBe(false);
    expect(evaluateActivationSchema(rows, [], shapeHash).ledger.state).toBe('Missing');
    rows[0].observation.constraints = rows[0].observation.constraints.filter(c => c.type !== 'c');
    expect(evaluateActivationSchema(rows, ledger(), shapeHash).status).toBe('NotQualified');
  });
  it.each(["'committed::text'::text", "'comm(itted)'::text", "'broken"])(
    'does not normalize a different default literal into a valid contract: %s', value => {
      const rows = fixture(); rows[0].observation.columns.find(c => c.name === 'state')!.default = value;
      expect(evaluateActivationSchema(rows, ledger(), shapeHash).status).toBe('NotQualified');
    });
  it('does not normalize different CHECK literals into the expected enum values', () => {
    const rows = fixture();
    rows[0].observation.constraints[4].expression = "(state = ANY (ARRAY['committed::text'::text, 'cancelled'::text]))";
    expect(evaluateActivationSchema(rows, ledger(), shapeHash).status).toBe('NotQualified');
  });
  it.each(['pk','future-time','rls','column-default','extra-ledger-column','trigger','rule','nulls-not-distinct','ordinal','operator-class'])(
    'rejects incompatible ledger or physical shape detail: %s', mutation => {
      const rows = fixture(); const record = ledger(); const o = rows[0].observation;
      switch (mutation) {
        case 'pk': o.ledgerKeyValid = false; break;
        case 'future-time': record[0].appliedAtValid = false; break;
        case 'rls': o.ledgerTable.rls = true; break;
        case 'column-default': o.ledgerColumns[0].default = "'invented'"; break;
        case 'extra-ledger-column': o.ledgerColumns.push({ ...o.ledgerColumns[0], name: 'unknown' }); break;
        case 'trigger': o.table.triggers = true; break;
        case 'rule': o.table.rules = true; break;
        case 'nulls-not-distinct': o.indexes[1].nullsNotDistinct = true; break;
        case 'ordinal': o.columns[0].ordinal = 2; break;
        case 'operator-class': o.indexes[1].operators[0].default = false; break;
      }
      expect(evaluateActivationSchema(rows, record, shapeHash).status).toBe('NotQualified');
    });
  it.each(['contract','migrationName','sourceSqlSha256','contractShapeSha256'])('rejects ledger mismatch %s', key => {
    const rows: Array<Record<string,unknown>> = ledger(); rows[0][key] = 'foreign';
    expect(evaluateActivationSchema(fixture(), rows, shapeHash).status).toBe('NotQualified');
  });
  it('holds missing or duplicate ledger rows and absent canonical source pin', () => {
    expect(evaluateActivationSchema(fixture(), [], shapeHash).status).toBe('NotQualified');
    expect(evaluateActivationSchema(fixture(), [...ledger(), ...ledger()], shapeHash).status).toBe('NotQualified');
    expect(evaluateActivationSchema(fixture(), ledger(), null).codes).toContain('schema_contract_pin_unqualified');
  });
  it.each<unknown>([null, [], [{}], [{ observation: 'raw-error' }]])('holds malformed catalog data case %# %p', value => {
    expect(evaluateActivationSchema(value, ledger(), shapeHash).status).toBe('NotQualified');
  });
  it('queries fixed public objects without Prisma-migration assumptions or write statements', () => {
    expect(ACTIVATION_CATALOG_SQL).toContain("n.nspname='public'");
    expect(ACTIVATION_LEDGER_SQL).toContain('"public"."HappyMEngineSchemaLedger"');
    expect(ACTIVATION_CATALOG_SQL + ACTIVATION_LEDGER_SQL).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|CALL)\b/i);
    expect(ACTIVATION_CATALOG_SQL + ACTIVATION_LEDGER_SQL).not.toContain('_prisma_migrations');
  });
  it('returns finite NotQualified/unknown on DB failure without reflecting an error, secret or image claim', async () => {
    const prisma = { $transaction: jest.fn().mockRejectedValue(new Error('private-token-and-database-location')) };
    const response = await new HappyMActivationReadinessService(prisma as unknown as PrismaService).observe('b'.repeat(64));
    expect(response.nonce).toBe('b'.repeat(64)); expect(response.status).toBe('NotQualified');
    expect(response.schema.codes).toEqual(['schema_observation_unavailable']);
    expect(response.schema.ledger.state).toBe('NotObserved');
    expect(response.externalEvidence).toEqual({ image: 'NotObserved', egress: 'NotObserved' });
    expect(JSON.stringify(response)).not.toContain('private-token');
  });
  it('rejects invalid nonce before acquiring a DB transaction', async () => {
    const prisma = { $transaction: jest.fn() };
    await expect(new HappyMActivationReadinessService(prisma as unknown as PrismaService).observe('invalid'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('runs real service branches with a read-only transaction and skips missing ledger query', async () => {
    const rows = fixture(); rows[0].observation.ledgerTable = null!; rows[0].observation.ledgerColumns = [];
    const tx = { $executeRaw: jest.fn().mockResolvedValue(0), $queryRaw: jest.fn().mockResolvedValue(rows) };
    const prisma = { $transaction: jest.fn(async (action: (value: typeof tx) => Promise<unknown>) => action(tx)) };
    const response = await new HappyMActivationReadinessService(prisma as unknown as PrismaService).observe('c'.repeat(64));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); expect(tx.$executeRaw.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(response.schema.status).toBe('NotQualified'); expect(response.schema.ledger.state).toBe('Missing');
    expect(response.sender.isolatedTestSender).toBe('NotQualified'); expect(response.status).toBe('NotQualified');
  });
  it('observed qualified schema data never promotes the overall native/image/sender status', async () => {
    const records = ledger(); records[0].contractShapeSha256 = activationContractShapeSha256!;
    const tx = { $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValueOnce(fixture()).mockResolvedValueOnce(records) };
    const prisma = { $transaction: jest.fn(async (action: (value: typeof tx) => Promise<unknown>) => action(tx)) };
    const response = await new HappyMActivationReadinessService(prisma as unknown as PrismaService).observe('d'.repeat(64));
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); expect(response.schema.status).toBe('Qualified');
    expect(response.status).toBe('NotQualified'); expect(response.sender.isolatedTestSender).toBe('NotQualified');
    expect(response.externalEvidence).toEqual({ image: 'NotObserved', egress: 'NotObserved' });
  });
});
