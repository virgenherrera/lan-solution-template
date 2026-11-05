import { builtinModules } from 'node:module';

type ExternalsData = { request?: string };
type ExternalsCallback = (error?: Error | null, result?: string) => void;
type RspackNamespace = {
  IgnorePlugin: new (options: { resourceRegExp: RegExp }) => unknown;
  optimize: { LimitChunkCountPlugin: new (options: { maxChunks: number }) => unknown };
  SwcJsMinimizerRspackPlugin: new (options: {
    minimizerOptions: { compress: { keep_classnames: boolean }; mangle: { keep_classnames: boolean } };
  }) => unknown;
};

const nodeBuiltins = new Set<string>(builtinModules);

// Shared Nest CLI rspack overrides. The CLI spreads the returned object over its
// own defaults and runs this file from the app directory that invokes it.
export default (defaults: { plugins: unknown[] }, rspack: RspackNamespace) => ({
  optimization: {
    // Keep class names: nestjs-zod resolves the reflector by the class name 'Reflector', which minification would rename.
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: { compress: { keep_classnames: true }, mangle: { keep_classnames: true } },
      }),
    ],
  },
  externals: [
    ({ request }: ExternalsData, callback: ExternalsCallback) => {
      if (!request) return callback();
      // Every node: scheme request is a runtime builtin, including ones builtinModules omits (node:sea).
      const bare = request.startsWith('node:') ? request.slice(5) : request;
      if (request.startsWith('node:') || nodeBuiltins.has(bare)) {
        return callback(undefined, `node-commonjs ${request}`);
      }
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
