/**
 * Nx Release version actions for the lockstep product version (REQ-VERSION-01, REQ-VERSION-03).
 *
 * Nx Release only knows `package.json` here (no `@nx/js` is installed). This class writes the new
 * version to the project `package.json`. For a project that owns a Tauri crate (`src-tauri/`) it also
 * writes the same version to `Cargo.toml`, to the matching `[[package]]` entry of `Cargo.lock` and to
 * `tauri.conf.json`. Internal dependencies use `workspace:*`, so there are no dependency ranges to update.
 *
 * Nx flushes its virtual tree to disk only after every project ran, and the flush is not atomic. So a
 * project fails before the flush when any of its target files is not writable: nothing is written and
 * the monorepo keeps one version.
 *
 * Wired by `release.groups.lockstep.version.versionActions` in nx.json. Check the result with
 * `node tools/scripts/version-check.ts`.
 */

import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import { VersionActions } from "nx/release";

interface TreeLike {
  root?: string;
  exists(path: string): boolean;
  read(path: string, encoding: "utf-8"): string | null;
  write(path: string, content: string): void;
}

const TAURI_DIR = "src-tauri";

function readText(tree: TreeLike, path: string): string {
  const content = tree.read(path, "utf-8");
  if (content === null) {
    throw new Error(`release-version-actions: cannot read ${path}`);
  }
  return content;
}

/** Throws when an existing file on disk is not writable, so the failure happens before Nx flushes any file. */
function assertWritable(tree: TreeLike, path: string): void {
  if (tree.root === undefined || !tree.exists(path)) {
    return;
  }
  try {
    accessSync(join(tree.root, path), constants.W_OK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw new Error(`release-version-actions: ${path} is not writable; no file was changed (${(error as Error).message})`);
  }
}

/** Replaces the top-level (2-space indent) `"version"` of a JSON text and keeps the rest byte-identical. */
function replaceJsonVersion(text: string, newVersion: string, label: string): string {
  const pattern = /^( {2}"version":\s*)"[^"]*"/m;
  if (!pattern.test(text)) {
    throw new Error(`release-version-actions: top-level version not found in ${label}`);
  }
  return text.replace(pattern, `$1"${newVersion}"`);
}

/** Replaces the first `version = "..."` line that follows `anchor` in a TOML text. */
function replaceTomlVersion(text: string, anchor: RegExp, newVersion: string, label: string): string {
  const match = anchor.exec(text);
  if (match === null) {
    throw new Error(`release-version-actions: ${label} not found`);
  }
  const from = match.index + match[0].length;
  const rest = text.slice(from).replace(/^version = "[^"]*"/m, `version = "${newVersion}"`);
  return text.slice(0, from) + rest;
}

export default class LockstepVersionActions extends VersionActions {
  validManifestFilenames = ["package.json"];

  private get root(): string {
    return this.projectGraphNode.data.root;
  }

  private manifestPath(): string {
    return `${this.root}/package.json`.replace(/^\.\//, "");
  }

  async readCurrentVersionFromSourceManifest(tree: TreeLike) {
    const manifestPath = this.manifestPath();
    const json = JSON.parse(readText(tree, manifestPath)) as { version: string };
    return { currentVersion: json.version, manifestPath };
  }

  async readCurrentVersionFromRegistry() {
    return null;
  }

  async readCurrentVersionOfDependency() {
    return { currentVersion: null, dependencyCollection: null };
  }

  async updateProjectDependencies(): Promise<string[]> {
    return [];
  }

  async updateProjectVersion(tree: TreeLike, newVersion: string): Promise<string[]> {
    const logs: string[] = [];
    const manifestPath = this.manifestPath();
    const tauriDir = `${this.root}/${TAURI_DIR}`.replace(/^\.\//, "");
    for (const path of [manifestPath, `${tauriDir}/Cargo.toml`, `${tauriDir}/Cargo.lock`, `${tauriDir}/tauri.conf.json`]) {
      assertWritable(tree, path);
    }
    tree.write(manifestPath, replaceJsonVersion(readText(tree, manifestPath), newVersion, manifestPath));
    logs.push(`${manifestPath} -> ${newVersion}`);

    const cargoPath = `${tauriDir}/Cargo.toml`;
    if (!tree.exists(cargoPath)) {
      return logs;
    }

    const cargo = readText(tree, cargoPath);
    const crate = /^\[package\][\s\S]*?^name = "([^"]+)"/m.exec(cargo)?.[1];
    if (crate === undefined) {
      throw new Error(`release-version-actions: no package name in ${cargoPath}`);
    }
    tree.write(cargoPath, replaceTomlVersion(cargo, /^\[package\]\s*$/m, newVersion, `[package] in ${cargoPath}`));
    logs.push(`${cargoPath} -> ${newVersion}`);

    const lockPath = `${tauriDir}/Cargo.lock`;
    if (tree.exists(lockPath)) {
      const anchor = new RegExp(`^name = "${crate}"\\s*$`, "m");
      tree.write(lockPath, replaceTomlVersion(readText(tree, lockPath), anchor, newVersion, `crate ${crate} in ${lockPath}`));
      logs.push(`${lockPath} -> ${newVersion}`);
    }

    const confPath = `${tauriDir}/tauri.conf.json`;
    tree.write(confPath, replaceJsonVersion(readText(tree, confPath), newVersion, confPath));
    logs.push(`${confPath} -> ${newVersion}`);
    return logs;
  }
}
