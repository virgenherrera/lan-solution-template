import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { RepoRoot } from '../services/repo-root.service.js';

// Where the SEA assembler writes. Everything under dist/ is created at build time and never committed.
@Injectable()
export class SeaPaths {
  constructor(private readonly repo: RepoRoot) {}

  get root(): string {
    return this.repo.path;
  }

  get workDir(): string {
    return join(this.root, 'dist', 'sea-package');
  }

  // Built service bootstraps are staged here, one copy per registered service; the SEA entry reaches them through the alias sea-services.
  get servicesDir(): string {
    return join(this.workDir, 'services');
  }

  get bundlePath(): string {
    return join(this.workDir, 'sea-app.mjs');
  }

  get servicesPath(): string {
    return join(this.workDir, 'services.json');
  }

  get configPath(): string {
    return join(this.workDir, 'sea-config.json');
  }

  get webManifestPath(): string {
    return join(this.workDir, 'web-manifest.json');
  }

  get vectorPinPath(): string {
    return join(this.workDir, 'sqlite-vector-pin.json');
  }

  // Versioned pin table of the sqlite-vector library (REQ-DB-09): source, version and sha256 per platform.
  get vectorTablePath(): string {
    return join(this.root, 'tools', 'vector', 'sqlite-vector-1.1.2.json');
  }

  // Downloaded tarballs are cached here and re-verified on every build.
  get vectorCacheDir(): string {
    return join(this.root, 'dist', 'vector-cache');
  }

  get seaEntry(): string {
    return join(this.root, 'apps', 'sea-runtime', 'src', 'sea-entry.ts');
  }

  get seaServicesSource(): string {
    return join(this.root, 'apps', 'sea-runtime', 'src', 'services.ts');
  }

  get sharedNestConfig(): string {
    return join(this.root, 'tools', 'rspack', 'nest.config.ts');
  }

  artifactDir(supervisor: string): string {
    return join(this.root, 'artifacts', supervisor);
  }
}
