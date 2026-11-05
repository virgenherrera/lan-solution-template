// Time enters the supervisor through this class, so the restart delays can be driven and measured.
export abstract class Clock {
  abstract now(): number;
}
