// 用假的 DSH ctx 跑一遍插件：工具注册、执行、HTTP 路由、技能提供者
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import { apply, inject } from '../src/index.js'
import { rank } from '../src/rank.js'
import { fuse, dimsOf } from '../src/topics.js'

function fakeCtx() {
  const tools = new Map(), routes = [], providers = []
  return {
    tools: { register: t => { tools.set(t.name, t); return () => tools.delete(t.name) } },
    webServer: { register: r => { routes.push(r); return () => {} } },
    skills: { registerProvider: f => { providers.push(f({ signal: new AbortController().signal, invalidate() {} })); return () => {} } },
    effect: f => f(),
    _tools: tools, _routes: routes, _providers: providers,
  }
}

const sample = [
  { key: 'gh:a/agent', title: 'a/agent：open-source AI agent for video editing', link: 'https://github.com/a/agent', platform: 'GitHub', zone: 'tools', metrics: { stars: 900 }, published: new Date(Date.now() - 20 * 36e5).toISOString() },
  { key: 'gh:b/x-win', title: 'b/x-win：Photo editor on Windows 11', link: 'https://github.com/b/x-win', platform: 'GitHub', zone: 'tools', metrics: { stars: 5000 }, published: new Date().toISOString() },
  { key: 'hn:1', title: 'OpenAI releases a new reasoning model', link: 'https://x', platform: 'Hacker News', zone: 'global', metrics: { score: 500, comment: 300 }, published: new Date(Date.now() - 5 * 36e5).toISOString() },
  { key: 'hn:2', title: 'Gardening tips for winter', link: 'https://y', platform: 'Hacker News', zone: 'global', metrics: { score: 800 }, published: new Date().toISOString() },
  { key: 'bili:1', title: '【AI全民制作人】用AI做了一部短剧', link: 'https://b', platform: 'B站', zone: 'cn', metrics: { view: 1e6, like: 5e4 }, published: new Date(Date.now() - 30 * 36e5).toISOString() },
]

test('rank：过滤无关和刷星仓库，分栏打分', () => {
  const z = rank(sample)
  assert.deepEqual(z.tools.items.map(i => i.key), ['gh:a/agent'])
  assert.deepEqual(z.global.items.map(i => i.key), ['hn:1'])
  assert.equal(z.cn.items.length, 1)
  assert.ok(z.global.items[0].score > 0)
})

test('topics：五元组拆解 + 选题卡', () => {
  const d = dimsOf(sample[2])
  assert.ok(d.P.some(([c]) => c === 'OpenAI'))
  const r = fuse([sample[0], sample[2]], sample.map(s => ({ ...s, score: 60 })))
  assert.ok(r.candidates.length >= 1)
  assert.ok(r.candidates[0].score > 0 && r.candidates[0].titles[0])
  assert.match(r.formula.expr, /选题/)
})

test('apply：注册工具/路由/技能，离线读写日报', async () => {
  assert.deepEqual(inject, ['tools', 'webServer'])
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-radar-'))
  const ctx = fakeCtx()
  await apply(ctx, { dataDir, sources: [] })     // 不联网：没有数据源
  assert.ok(ctx._tools.has('radar_daily') && ctx._tools.has('radar_topics'))
  assert.equal(ctx._routes[0].path, '/dsh-radar')
  const skills = await ctx._providers[0].list({})
  assert.equal(skills[0].name, 'daily-radar')
  const out = await ctx._tools.get('radar_daily').execute({ refresh: true }, {})
  assert.match(out.markdown, /每日雷达/)
  // 通过真实 http 服务器打一遍路由
  const srv = http.createServer((q, s) => ctx._routes[0].handler(q, s)).listen(0)
  const base = `http://127.0.0.1:${srv.address().port}/dsh-radar`
  const day = await (await fetch(base + '/day')).json()
  assert.equal(day.doc.date.length, 10)
  const cfg = await (await fetch(base + '/config')).json()
  assert.equal(cfg.mode, 'anonymous')
  const css = await fetch(base + '/style.css'); assert.equal(css.status, 200)
  srv.close()
})
