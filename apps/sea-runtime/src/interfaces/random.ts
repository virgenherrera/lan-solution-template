// Randomness enters the supervisor through this class, so the restart jitter can be driven and measured.
export abstract class Random {
  abstract next(): number;
}
