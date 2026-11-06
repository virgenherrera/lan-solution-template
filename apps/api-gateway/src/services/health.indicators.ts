import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { DatabaseService } from '../database/database.module.js';
import { HealthState } from './health-state.js';

// The aggregate state of the runtime as last told by the supervisor. Always up: it reports the state, it does not judge it.
@Injectable()
export class StateIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly state: HealthState,
  ) {}

  check(): HealthIndicatorResult {
    return this.indicators.check('state').up({ state: this.state.get() });
  }
}

// Seconds this process has been running.
@Injectable()
export class UptimeIndicator {
  constructor(private readonly indicators: HealthIndicatorService) {}

  check(): HealthIndicatorResult {
    return this.indicators.check('uptime').up({ seconds: Math.round(process.uptime()) });
  }
}

// Dummy value for now: it proves the query flag and the DTO, it measures nothing.
@Injectable()
export class MemoryIndicator {
  static readonly DUMMY_MB = 42;

  constructor(private readonly indicators: HealthIndicatorService) {}

  check(): HealthIndicatorResult {
    return this.indicators.check('memory').up({ usedMb: MemoryIndicator.DUMMY_MB, dummy: true });
  }
}

// Asks the connection the service already holds; it opens nothing. Same question the startup handshake asks.
@Injectable()
export class DbIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly database: DatabaseService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const session = this.indicators.check('db');
    try {
      const rows = await this.database.adapter.all('SELECT 1 AS ok');
      if (Number(rows[0]?.['ok']) !== 1) return session.down({ engine: this.database.adapter.engine, message: 'SELECT 1 did not answer 1' });
      return session.up({ engine: this.database.adapter.engine });
    } catch (error) {
      return session.down({ message: error instanceof Error ? error.message : String(error) });
    }
  }
}
