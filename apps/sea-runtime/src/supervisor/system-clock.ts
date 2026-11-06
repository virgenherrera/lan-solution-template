import { Injectable } from '@nestjs/common';
import { Clock } from './clock.js';

@Injectable()
export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}
