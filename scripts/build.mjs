// 产出 dist/：package.json（去掉 scripts）+ lib/（源码原样拷贝，零依赖、无需打包）+ skills/ + README/LICENSE
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url), dist = new URL('../dist/', import.meta.url)
await rm(dist, { recursive: true, force: true })
await mkdir(new URL('lib/', dist), { recursive: true })
for (const f of ['index.js', 'client.js', 'style.css', 'engine.js', 'sources.js', 'rank.js', 'topics.js']) await cp(new URL('src/' + f, root), new URL('lib/' + f, dist))
await cp(new URL('skills/', root), new URL('skills/', dist), { recursive: true })
for (const f of ['README.md', 'LICENSE', 'cordis.patch.yml', 'icon.svg']) await cp(new URL(f, root), new URL(f, dist)).catch(() => {})
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
delete pkg.scripts
await writeFile(new URL('package.json', dist), JSON.stringify(pkg, null, 2))
console.log('built dist/')
