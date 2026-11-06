// Specifiers that tools/scripts/compile-sea.ts aliases to the built bootstraps when it bundles sea-entry.ts.
declare module 'sea-supervisor';
declare module 'sea-certs-command' {
  export function runGenerateCerts(): number;
}
