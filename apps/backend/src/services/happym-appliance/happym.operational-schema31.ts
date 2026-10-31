import { ServiceUnavailableException } from '@nestjs/common';
/** Actual pg_catalog rows only. A proposed migration or caller DTO is no proof. */
export function requireOperationalCatalog31(columns: any[], constraints: any[]): void {
  const expected: Record<string, [string, boolean]> = {
    'NativeWorkspaceOwner31.organizationId': ['text', true], 'NativeWorkspaceOwner31.userId': ['text', true],
    'NativeWorkspaceOwner31.consumerKey': ['character(64)', true], 'NativeWorkspaceOwner31.metadataJson': ['text', true],
    'NativeOperationalRegistration31.operationId': ['character(64)', true], 'NativeOperationalRegistration31.requestId': ['character(32)', true],
    'NativeOperationalRegistration31.consumerKey': ['character(64)', true], 'NativeOperationalRegistration31.revision': ['integer', true],
    'NativeOperationalRegistration31.previousOperationId': ['character(64)', false], 'NativeOperationalRegistration31.receiptJson': ['text', true],
  };
  const fail = (): never => { throw new ServiceUnavailableException({ code: 'operational31_schema_not_qualified' }); };
  if (!Array.isArray(columns) || columns.length !== 10 || !Array.isArray(constraints) || constraints.length !== 7) fail();
  const seen = new Set<string>();
  for (const row of columns) {
    const id = row.tableName + '.' + row.columnName, shape = expected[id];
    if (!shape || seen.has(id) || row.type !== shape[0] || row.notNull !== shape[1] || row.canSelect !== true || row.canInsert !== true) fail();
    seen.add(id);
  }
  const wanted = new Set(['NativeWorkspaceOwner31:p:organizationId', 'NativeWorkspaceOwner31:u:userId',
    'NativeWorkspaceOwner31:u:consumerKey,metadataJson', 'NativeOperationalRegistration31:p:operationId',
    'NativeOperationalRegistration31:u:requestId', 'NativeOperationalRegistration31:u:consumerKey,revision',
    'NativeOperationalRegistration31:f:previousOperationId']);
  for (const row of constraints) {
    if (!wanted.delete(row.tableName + ':' + row.kind + ':' + (Array.isArray(row.columns) ? row.columns.join(',') : '?'))
      || row.validated !== true || row.deferred !== false) fail();
    if (row.kind === 'f' && (row.foreignSchema !== 'public' || row.foreignTable !== 'NativeOperationalRegistration31'
      || !Array.isArray(row.foreignColumns) || row.foreignColumns.join(',') !== 'operationId' || row.onDelete !== 'r' || row.onUpdate !== 'r')) fail();
  }
  if (wanted.size) fail();
}
