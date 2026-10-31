import { builtinModules } from 'node:module';

type ExternalsData = { request?: string };
type ExternalsCallback = (error?: Error | null, result?: string) => void;
type RspackNamespace = {
  IgnorePlugin: new (options: { resourceRegExp: RegExp }) => unknown;
  optimize: { LimitChunkCountPlugin: new (options: { maxChunks: number }) => unknown };
};

const nodeBuiltins = new Set<string>(builtinModules);

// Shared Nest CLI rspack overrides. The CLI spreads the returned object over its
// own defaults and runs this file from the app directory that invokes it.
export default (defaults: { plugins: unknown[] }, rspack: RspackNamespace) => ({
  externals: [
    ({ request }: ExternalsData, callback: ExternalsCallback) => {
      if (!request) return callback();
      const bare = request.startsWith('node:') ? request.slice(5) : request;
      if (nodeBuiltins.has(bare)) return callback(undefined, `node-commonjs ${request}`);
      callback();
    },
  ],
  plugins: [
    ...defaults.plugins,
    new rspack.IgnorePlugin({
      resourceRegExp: /^(@nestjs\/(microservices|websockets|platform-express)(\/.*)?|class-validator|class-transformer(\/.*)?)$/,
    }),
    new rspack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
});
