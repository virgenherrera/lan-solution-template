import { Injectable } from '@nestjs/common';
import { Random } from '../interfaces/random.js';

@Injectable()
export class SystemRandom extends Random {
  next(): number {
    return Math.random();
  }
}
