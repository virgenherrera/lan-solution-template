// Specifiers that `tools-cli compile-sea` aliases to the built bootstraps when it bundles sea-entry.ts.
declare module 'sea-supervisor';
declare module 'sea-certs-command' {
  export function runGenerateCerts(): number;
}
