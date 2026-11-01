import { Service, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

@Service()
export class ThemeService {
  readonly theme = signal<AppTheme>(this.initial());

  toggle(): void {
    this.apply(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private initial(): AppTheme {
    // The inline script in index.html already set data-theme before first paint.
    return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
  }

  private apply(next: AppTheme): void {
    this.theme.set(next);
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the theme still applies for this page view.
    }
  }
}
