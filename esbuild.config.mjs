/**
 * Build both halves of the bundle with esbuild.
 *
 * The Host half is an ESM library Node imports directly; the Client half is a
 * classic browser script whose entry registers a lazy factory with the Web
 * shell's module loader. Neither half imports React at build time: the factory
 * receives the shell's shared React through its `require` seed.
 */

import { build } from 'esbuild'

const shared = {
  bundle: true,
  logLevel: 'info',
  legalComments: 'none',
  sourcemap: false,
}

await build({
  ...shared,
  entryPoints: ['src/host/index.ts'],
  outfile: 'index.js',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
})

await build({
  ...shared,
  entryPoints: ['src/client/index.ts'],
  outfile: 'client.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
})
