import { parseArgs } from 'node:util';
import { Injectable } from '@nestjs/common';

export interface BuildTarget {
  triple: string;
  // Node binary used as the SEA base; undefined means the running Node (native build).
  executable: string | undefined;
}

// Keys are "<process.platform> <process.arch>"; values are Rust target triples (the Tauri sidecar naming).
const TARGET_TRIPLES: Readonly<Record<string, string>> = {
  'darwin arm64': 'aarch64-apple-darwin',
  'darwin x64': 'x86_64-apple-darwin',
  'linux x64': 'x86_64-unknown-linux-gnu',
  'linux arm64': 'aarch64-unknown-linux-gnu',
  'win32 x64': 'x86_64-pc-windows-msvc',
  'win32 arm64': 'aarch64-pc-windows-msvc',
};

// Target triple to the platform key of the pin table (the runtime key of sqlite-vector.ts). Linux triples here are glibc.
const VECTOR_PLATFORM_KEYS: Readonly<Record<string, string>> = {
  'aarch64-apple-darwin': 'darwin-arm64',
  'x86_64-apple-darwin': 'darwin-x64',
  'x86_64-unknown-linux-gnu': 'linux-x64-glibc',
  'aarch64-unknown-linux-gnu': 'linux-arm64-glibc',
  'x86_64-pc-windows-msvc': 'win32-x64',
};

@Injectable()
export class SeaTargetService {
  hostTriple(): string {
    const triple = TARGET_TRIPLES[`${process.platform} ${process.arch}`];
    if (triple === undefined) {
      throw new Error(`unsupported platform ${process.platform} ${process.arch}: no Rust target triple`);
    }
    return triple;
  }

  vectorPlatformKey(triple: string): string | undefined {
    return VECTOR_PLATFORM_KEYS[triple];
  }

  // Native by default; a target that differs from the host needs the target's own Node binary.
  resolve(argv: readonly string[]): { supervisor: string; target: BuildTarget } {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { target: { type: 'string' }, executable: { type: 'string' } },
    });
    const [supervisor, ...extra] = positionals;
    if (!supervisor || extra.length > 0) {
      throw new Error('usage: tools-cli compile-sea <supervisor-project> [--target <triple> --executable <node-binary>]');
    }
    const host = this.hostTriple();
    const triple = values.target ?? host;
    if (!Object.values(TARGET_TRIPLES).includes(triple)) throw new Error(`unknown --target "${triple}"`);
    if (triple !== host && values.executable === undefined) {
      throw new Error(`cross build for ${triple} on ${host} needs --executable <node binary of the target>`);
    }
    if (triple === host && values.executable !== undefined) {
      throw new Error('--executable is only for a cross build; omit it for a native build');
    }
    return { supervisor, target: { triple, executable: values.executable } };
  }
}
