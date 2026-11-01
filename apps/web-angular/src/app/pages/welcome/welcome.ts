import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '../../core/session';

@Component({
  imports: [],
  selector: 'app-welcome',
  styleUrl: './welcome.css',
  templateUrl: './welcome.html',
})
export class Welcome {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  // PLACEHOLDER: flips the in-memory flag only. No credentials; real authentication is POC-7.
  protected enter(): void {
    this.session.enter();
    void this.router.navigateByUrl('/dashboard');
  }
}
