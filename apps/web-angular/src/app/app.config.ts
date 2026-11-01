import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Remove the CSS-only splash from index.html once the app initializes.
    provideAppInitializer(() => {
      document.getElementById('splash')?.remove();
    }),
  ],
};
