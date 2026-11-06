import { Injectable } from '@nestjs/common';
import { Random } from './random.js';

@Injectable()
export class SystemRandom extends Random {
  next(): number {
    return Math.random();
  }
}
