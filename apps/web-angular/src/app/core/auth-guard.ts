import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';

// PLACEHOLDER guard: checks only the in-memory session flag. Real authentication is POC-7.
export const authGuard: CanActivateFn = () => {
  return inject(Session).entered() ? true : inject(Router).createUrlTree(['/']);
};
