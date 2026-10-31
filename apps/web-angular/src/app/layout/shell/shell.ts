import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from '../../core/session';
import { ThemeService } from '../../core/theme-service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-shell',
  styleUrl: './shell.css',
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly session = inject(Session);
}
