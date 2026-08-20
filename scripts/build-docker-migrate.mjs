import * as esbuild from 'esbuild'

await esbuild.build({
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  bundle: true,
  entryPoints: ['scripts/docker-migrate.mjs', 'scripts/docker-s3-init.mjs'],
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node22',
})

console.log('✅ Bundled Docker startup entries: dist/docker-migrate.mjs, dist/docker-s3-init.mjs')
