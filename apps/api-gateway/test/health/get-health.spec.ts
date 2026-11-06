import { getTestContext, type TestContext } from '../get-test-context.js';

class GetHealthTestCase {
  static readonly base = 'Should GET the terminus report with state and the default uptime.';
  static readonly uptimeOff = 'Should remove the uptime indicator with uptime=false.';
  static readonly memoryOn = 'Should add the memory indicator with memory=true.';
  static readonly dbOn = 'Should add the db indicator with db=true.';
  static readonly allFlags = 'Should combine every flag.';
  static readonly flagAliases = 'Should read 1, yes and on as true and anything else as false.';
  static readonly unknownQuery = 'Should ignore unknown query params.';
  static readonly notFound = 'Should return not found for unknown routes.';
}

const up = (extra: object = {}) => expect.objectContaining({ status: 'up', ...extra });

describe('e2e: GET /api/health', () => {
  let ctx: TestContext;

  beforeAll(async () => (ctx = await getTestContext()));
  afterAll(async () => ctx.dispose());

  it(GetHealthTestCase.base, async () => {
    const res = await ctx.request.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.error).toEqual({});
    expect(Object.keys(res.body.details).sort()).toEqual(['state', 'uptime']);
    expect(res.body.details.state).toEqual({ status: 'up', state: 'starting' });
    expect(res.body.details.uptime).toEqual(up({ seconds: expect.any(Number) }));
    expect(res.body.info).toEqual(res.body.details);
  });

  it(GetHealthTestCase.uptimeOff, async () => {
    const res = await ctx.request.get('/api/health').query({ uptime: 'false' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.details)).toEqual(['state']);
  });

  it(GetHealthTestCase.memoryOn, async () => {
    const res = await ctx.request.get('/api/health').query({ memory: 'true' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.details).sort()).toEqual(['memory', 'state', 'uptime']);
    expect(res.body.details.memory).toEqual({ status: 'up', usedMb: 42, dummy: true });
  });

  it(GetHealthTestCase.dbOn, async () => {
    const res = await ctx.request.get('/api/health').query({ db: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.details.db).toEqual({ status: 'up', engine: 'sqlite' });
  });

  it(GetHealthTestCase.allFlags, async () => {
    const res = await ctx.request.get('/api/health').query({ uptime: 'false', memory: 'true', db: 'true' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.details).sort()).toEqual(['db', 'memory', 'state']);
  });

  it(GetHealthTestCase.flagAliases, async () => {
    for (const value of ['1', 'yes', 'ON', 'True']) {
      const res = await ctx.request.get('/api/health').query({ memory: value });
      expect(res.body.details).toHaveProperty('memory');
    }
    for (const value of ['0', 'no', 'off', 'banana', '']) {
      const res = await ctx.request.get('/api/health').query({ memory: value });
      expect(res.body.details).not.toHaveProperty('memory');
    }
  });

  it(GetHealthTestCase.unknownQuery, async () => {
    const res = await ctx.request.get('/api/health').query({ foo: 'bar' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.details).sort()).toEqual(['state', 'uptime']);
  });

  it(GetHealthTestCase.notFound, async () => {
    const res = await ctx.request.get('/api/missing-route');

    expect(res.status).toBe(404);
  });
});
