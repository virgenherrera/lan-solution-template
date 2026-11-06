import { Injectable } from '@nestjs/common';
import { Clock } from '../interfaces/clock.js';

@Injectable()
export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}
