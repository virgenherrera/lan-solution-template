import { Component, inject } from '@angular/core';
import { ThemeService } from './core/theme-service';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly theme = inject(ThemeService);
}
