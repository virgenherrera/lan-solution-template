import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import supertest from 'supertest';

export interface TestContext {
  app: INestApplication;
  request: ReturnType<typeof supertest>;
  // Closes the app (and its database) and removes the scratch base.
  dispose(): Promise<void>;
}

// The gateway reads its base folder (cwd) when its modules load, so the scratch base is made and entered before AppModule is imported.
// A real SQLite database and the real config file in a temporary base: nothing is mocked. Nest serves it in memory, no port is opened.
export async function getTestContext(): Promise<TestContext> {
  const base = mkdtempSync(join(tmpdir(), 'gateway-e2e-'));
  mkdirSync(join(base, 'config'));
  writeFileSync(
    join(base, 'config', 'config.json'),
    JSON.stringify({
      db: { engine: 'sqlite', sqlite: { file: 'test.db', foreignKeys: true, journalMode: 'DELETE', synchronous: 'NORMAL' } },
      net: { bind: '127.0.0.1', httpsPort: 18443, httpPort: 18080 },
      tls: { extraNames: [] },
    }),
  );
  process.chdir(base);
  const { AppModule } = await import('../src/app.module.js');
  const { API_PREFIX } = await import('../src/api-prefix.js');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix(API_PREFIX);
  await app.init();
  const dispose = async (): Promise<void> => {
    await app.close();
    process.chdir(tmpdir());
    rmSync(base, { recursive: true, force: true });
  };
  return { app, request: supertest(app.getHttpServer()), dispose };
}
