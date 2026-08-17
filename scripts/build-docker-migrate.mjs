import * as esbuild from 'esbuild'

await esbuild.build({
  bundle: true,
  entryPoints: ['scripts/docker-migrate.mjs'],
  format: 'esm',
  outfile: 'dist/docker-migrate.mjs',
  platform: 'node',
  target: 'node22',
})

console.log('✅ Bundled Docker migrate entry: dist/docker-migrate.mjs')
