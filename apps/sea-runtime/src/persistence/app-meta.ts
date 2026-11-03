import { concatMap, defer, from, lastValueFrom, type Observable } from 'rxjs';
import type { DbAdapter } from 'shared-core';
import type { BuildInfo } from './build-info.js';

const UPSERT = 'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
// Written once, on the first start; later starts keep the original value.
const INSERT_IF_ABSENT = 'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING';

interface MetaWrite {
  readonly sql: string;
  readonly key: string;
  readonly value: string;
}

function metaWrites(info: BuildInfo, startedAt: string): MetaWrite[] {
  const refreshed = Object.entries({ ...info, last_started_at: startedAt }).map(([key, value]) => ({ sql: UPSERT, key, value }));
  return [...refreshed, { sql: INSERT_IF_ABSENT, key: 'first_installed_runtime_version', value: info.runtime_version }];
}

// Records the running build in app_meta. All writes share one transaction, so the table is never half updated.
export function writeAppMeta$(db: DbAdapter, info: BuildInfo): Observable<void> {
  return defer(() => {
    const writes = metaWrites(info, new Date().toISOString());
    return db.transaction(() =>
      lastValueFrom(from(writes).pipe(concatMap(({ sql, key, value }) => db.run(sql, [key, value]))), { defaultValue: undefined }),
    );
  });
}
