// 构建客户端 bundle：lazy-CJS factory 格式（window.__ModuleLoader__.load）。
// react 等基座模块保持 external，由页面模块表提供。
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

const result = await build({
  entryPoints: [join(root, 'src/client/index.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  external: ['react'],
  logLevel: 'silent',
})
const code = result.outputFiles[0].text
const wrapped = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(pkg.name)},`,
  '  factory(require) {',
  '    try {',
  '    const module = { exports: {} };',
  '    const exports = module.exports;',
  code,
  '    const plug = { inject: module.exports.inject, apply(ctx) { try { return module.exports.apply(ctx); } catch (e) { window.__FOLLOW_APPLY_ERR__ = String(e && e.stack || e); console.error("[follow-apply]", e && e.stack || e); throw e; } } };',
  '    window.__FOLLOW_PLUGIN__ = plug;',
  '    return plug;',
  '    } catch (e) { window.__FOLLOW_FACTORY_ERR__ = String(e && e.stack || e); console.error("[follow-factory]", e && e.stack || e); throw e; }',
  '  },',
  '});',
  '',
].join('\n')
await mkdir(join(root, 'dist'), { recursive: true })
await writeFile(join(root, 'dist/client.js'), wrapped, 'utf8')
console.log(`[build-client] dist/client.js written (${wrapped.length} bytes)`)