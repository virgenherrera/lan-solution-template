import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { type ServiceEntry as DeclaredEntry } from 'service-registry';
import { z } from 'zod';
import { RepoRoot } from '../services/repo-root.service.js';
import { parseJson, readJson } from './json-file.js';

// Only the fields this service reads. Files other tools own (package.json, angular.json, nx output) stay loose.
const mainPackageSchema = z.looseObject({ main: z.string().optional() });
const dependencyPackageSchema = z.looseObject({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});
const nxProjectSchema = z.looseObject({ root: z.string() });
const angularJsonSchema = z.looseObject({
  architect: z
    .looseObject({
      build: z
        .looseObject({
          options: z
            .looseObject({ outputPath: z.string().optional() })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

// The library that holds the dispatcher contract: a supervisor must depend on it.
const REGISTRY_LIB = 'service-registry';

export interface BuiltService {
  service: string;
  entryPath: string;
}

export interface WebBundle {
  name: string;
  dir: string;
}

// Built entry of a workspace library (package.json "main"); bundled into the executable, never started.
interface LibEntry {
  name: string;
  entryPath: string;
}

type Classified =
  | { kind: 'service'; entry: BuiltService }
  | { kind: 'web'; bundle: WebBundle }
  | { kind: 'lib'; lib: LibEntry };

// Dependencies of the supervisor (`workspace:` ranges) are classified by build output: <root>/dist/main.js is a service; <root>/dist/<name>/browser/index.html
// (or angular.json outputPath + /browser) is a web bundle; anything else fails. At most one web bundle; zero means no web assets and no --web flag.
@Injectable()
export class SeaDependenciesService {
  constructor(private readonly repo: RepoRoot) {}

  // Asks Nx where a project lives; the project name is the package name.
  projectRoot(name: string): string {
    const project = parseJson(
      `nx project ${name}`,
      execFileSync('pnpm', ['exec', 'nx', 'show', 'project', name, '--json'], {
        cwd: this.repo.path,
        encoding: 'utf8',
      }),
      nxProjectSchema,
    );
    return join(this.repo.path, project.root);
  }

  // Dependencies are the supervisor's workspace dependencies, read from its own package.json.
  discover(
    supervisor: string,
    supervisorDir: string,
    serviceEntry: string,
  ): { services: BuiltService[]; web: WebBundle | undefined } {
    const manifest = readJson(
      join(supervisorDir, 'package.json'),
      dependencyPackageSchema,
    );
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };
    const names = Object.keys(dependencies)
      .filter((name) => dependencies[name]?.startsWith('workspace:'))
      .sort();
    if (names.length === 0) {
      throw new Error(
        `${supervisor} has no workspace dependency to package as a service`,
      );
    }
    const classified = names.map((name) => this.classify(name, serviceEntry));
    const services = classified.flatMap((c) =>
      c.kind === 'service' ? [c.entry] : [],
    );
    const webs = classified.flatMap((c) =>
      c.kind === 'web' ? [c.bundle] : [],
    );
    if (
      !classified.some((c) => c.kind === 'lib' && c.lib.name === REGISTRY_LIB)
    ) {
      throw new Error(
        `${supervisor} must depend on the ${REGISTRY_LIB} library (workspace:*)`,
      );
    }
    if (webs.length > 1) {
      throw new Error(
        `exactly one web bundle is allowed; found ${webs.map((w) => w.name).join(', ')}`,
      );
    }
    if (services.length === 0) {
      throw new Error(
        `${supervisor} has no service dependency (${serviceEntry})`,
      );
    }
    return { services, web: webs[0] };
  }

  // Matches each declared route to the built service of its workspace project, so the entry table is keyed by route id. Runs before bundling and before `node --build-sea`.
  resolveRoutes(
    routes: readonly DeclaredEntry[],
    built: BuiltService[],
    supervisor: string,
    serviceEntry: string,
  ): BuiltService[] {
    return routes.map((route) => {
      const found = built.find((s) => s.service === route.id);
      if (found === undefined) {
        throw new Error(
          `service "${route.id}": project "${route.id}" is not a built workspace dependency of ${supervisor}; add it as "workspace:*" and build it (${serviceEntry})`,
        );
      }
      return { service: route.id, entryPath: found.entryPath };
    });
  }

  // Classifies one workspace dependency by its build output shape; the first matching shape wins.
  private classify(name: string, serviceEntry: string): Classified {
    const dir = this.projectRoot(name);
    const entry = join(dir, serviceEntry);
    if (existsSync(entry))
      return { kind: 'service', entry: { service: name, entryPath: entry } };
    const browser = this.webBrowserDir(name, dir);
    if (existsSync(join(browser, 'index.html')))
      return { kind: 'web', bundle: { name, dir: browser } };
    const main = readJson(join(dir, 'package.json'), mainPackageSchema).main;
    if (main !== undefined && existsSync(join(dir, main)))
      return { kind: 'lib', lib: { name, entryPath: join(dir, main) } };
    throw new Error(
      `${name}: neither a service (missing ${entry}), a web bundle (missing ${join(browser, 'index.html')}) nor a library (missing package.json "main" output); run the ${name} build target first`,
    );
  }

  // Angular browser output: angular.json outputPath (default dist/<name>) plus the application builder's browser/ folder.
  private webBrowserDir(name: string, projectDir: string): string {
    const angularJson = join(projectDir, 'angular.json');
    const config = existsSync(angularJson)
      ? readJson(angularJson, angularJsonSchema)
      : undefined;
    const outputPath =
      config?.architect?.build?.options?.outputPath ?? join('dist', name);
    return join(projectDir, outputPath, 'browser');
  }
}
