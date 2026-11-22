// dsh-radar · 引擎：采集 → 排序 → 存当日快照（JSON + Markdown），可被 DSH 插件或 CLI 调用
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { SOURCES } from './sources.js'
import { rank, DEFAULT_KEYWORDS } from './rank.js'
import { fuse, PROGRAMS } from './topics.js'

export const DEFAULT_CONFIG = {
  dataDir: path.join(os.homedir(), '.dsh-radar'),
  sources: ['hackernews', 'huggingface', 'github', 'bilibili', 'youtube'],
  youtubeChannels: [
    { id: 'UCSHZKyawb77ixDdsGog4iWA', name: 'Lex Fridman' }, { id: 'UCXl4i9dYBrFOabk0xGmbkRA', name: 'Dwarkesh Patel' },
    { id: 'UCbfYPyITQ-7l4upoX8nvctg', name: 'Two Minute Papers' }, { id: 'UCsBjURrPoezykLs9EqgamOA', name: 'Fireship' },
    { id: 'UCNJ1Ymd5yFuUPtn21xtRbbw', name: 'AI Explained' }, { id: 'UCcefcZRL2oaA_uBNeo5UOWg', name: 'Y Combinator' },
  ],
  keywords: DEFAULT_KEYWORDS,
  topN: 8,
  maxAgeDays: 7,
  programs: null,         // 自定义栏目：{ id: {name, need:'P|K|E|T', dur, angle, struct, hook, tpl:[...]} }；null = 用默认通用栏目
  login: {},              // 登录模式（可选，全部只读）：{ githubToken, biliSessdata } 或环境变量 GITHUB_TOKEN / BILI_SESSDATA
}

export function resolveConfig(user = {}) {
  const c = { ...DEFAULT_CONFIG, ...user, keywords: { ...DEFAULT_KEYWORDS, ...(user.keywords || {}) } }
  c.creds = {
    githubToken: user.login?.githubToken || process.env.GITHUB_TOKEN || '',
    biliSessdata: user.login?.biliSessdata || process.env.BILI_SESSDATA || '',
  }
  c.mode = c.creds.githubToken || c.creds.biliSessdata ? 'login' : 'anonymous'
  c.programDefs = user.programs && Object.keys(user.programs).length ? user.programs : PROGRAMS
  return c
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
const fileOf = (c, d) => path.join(c.dataDir, 'daily', `${d}.json`)
async function readJ(p, dflt) { try { return JSON.parse(await readFile(p, 'utf8')) } catch { return dflt } }

export async function listDates(c) {
  try { return (await readdir(path.join(c.dataDir, 'daily'))).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(0, 10)).sort().reverse() } catch { return [] }
}

export async function loadDay(c, d) {
  const dates = await listDates(c)
  const day = d || dates[0]
  return day ? readJ(fileOf(c, day), null) : null
}

/** 采集+排序+落盘。onLog(msg) 进度回调 */
export async function runRadar(c, { only = null, onLog = () => {} } = {}) {
  await mkdir(path.join(c.dataDir, 'daily'), { recursive: true })
  const prevP = path.join(c.dataDir, 'snapshot.json')
  const prev = await readJ(prevP, {})
  const stats = {}, items = []
  const ids = (only || c.sources).filter(id => SOURCES[id])
  await Promise.all(ids.map(async id => {
    const t0 = Date.now()
    try {
      const r = await SOURCES[id].fetch({ config: c, creds: c.creds })
      items.push(...r); stats[id] = { ok: true, n: r.length, ms: Date.now() - t0, login: SOURCES[id].login && Object.values(c.creds).some(Boolean) ? 'used' : 'none' }
      onLog(`✓ ${SOURCES[id].name} ${r.length} 条`)
    } catch (e) { stats[id] = { ok: false, error: String(e.message || e).slice(0, 160), ms: Date.now() - t0 }; onLog(`✗ ${SOURCES[id].name}：${stats[id].error}`) }
  }))
  const zones = rank(items, { keywords: c.keywords, prev, topN: c.topN, maxAgeDays: c.maxAgeDays })
  const snap = { ...prev }
  for (const z of Object.values(zones)) for (const it of z.items) snap[it.key] = { heat: it.heat, at: Date.now() }
  await writeFile(prevP, JSON.stringify(snap))
  const d = today()
  const doc = { date: d, generated_at: new Date().toISOString(), mode: c.mode, sources: stats, zones: Object.values(zones),
    total: items.length, kept: Object.values(zones).reduce((n, z) => n + z.items.length, 0) }
  await writeFile(fileOf(c, d), JSON.stringify(doc, null, 1))
  await writeFile(path.join(c.dataDir, 'daily', `${d}.md`), toMarkdown(doc))
  onLog(`完成：${doc.total} 条素材 → ${doc.kept} 条上榜`)
  return doc
}

const fmtN = n => (n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : String(Math.round(n)))
export function metricsText(m = {}) {
  const L = [['view', '播放'], ['like', '赞'], ['comment', '评'], ['score', '分'], ['stars', '★'], ['download', '下载']]
  return L.filter(([k]) => m[k]).map(([k, l]) => `${l} ${fmtN(m[k])}`).join(' · ')
}

export function toMarkdown(doc) {
  const L = [`# 每日雷达 ${doc.date}`, '', `> 模式：${doc.mode === 'login' ? '登录（只读用户自己的凭据）' : '免登录'} · 素材 ${doc.total} 条 → 上榜 ${doc.kept} 条 · 生成 ${doc.generated_at.slice(0, 16).replace('T', ' ')}`, '']
  for (const z of doc.zones) {
    L.push(`## ${z.title}`, '')
    if (!z.items.length) { L.push('- 今日无达标', ''); continue }
    z.items.forEach((it, i) => L.push(`${i + 1}. ${it.badge ? it.badge + ' · ' : ''}[${it.title}](${it.link})（${metricsText(it.metrics)}）· ${it.platform}${it.author ? ' · ' + it.author : ''} · 分 ${it.score}`))
    L.push('')
  }
  const bad = Object.entries(doc.sources).filter(([, s]) => !s.ok)
  if (bad.length) L.push('## 未取到', '', ...bad.map(([id, s]) => `- ${id}：${s.error}`), '')
  return L.join('\n')
}

/** 选题：keys 为日报里条目的 key；不给 keys 时取各栏前 2 条 */
export async function makeTopics(c, { date = null, keys = null, programs = null } = {}) {
  const doc = await loadDay(c, date)
  if (!doc) throw new Error('还没有雷达日报，先运行 radar_daily 刷新一次')
  const pool = doc.zones.flatMap(z => z.items)
  const basket = keys?.length ? pool.filter(it => keys.includes(it.key)) : doc.zones.flatMap(z => z.items.slice(0, 2))
  if (!basket.length) throw new Error('选题篮里没有可识别的条目（key 不在该日日报里）')
  return { date: doc.date, ...fuse(basket, pool, { programs, programDefs: c.programDefs }), basket: basket.map(({ key, title, link, platform }) => ({ key, title, link, platform })) }
}

export function topicsMarkdown(r) {
  const L = [`# 选题卡 ${r.date}`, '', `> ${r.formula.expr}`, `> ${r.formula.score}`, '', '## 大背景',
    `- 事件 E：${r.background.E.map(e => e.text).join('；') || '—'}`, `- 人物/公司 P：${r.background.P.map(a => a.name).join('、') || '—'}`,
    `- 关键词 K：${r.background.K.map(a => a.name).join('、') || '—'}`, `- 话题 T：${r.background.T.map(a => a.name).join('、') || '—'}`,
    `- 共振：${r.background.resonance.join('、') || '—'}`, '', '## 候选选题', '']
  r.candidates.forEach((c, i) => L.push(`### ${i + 1}. 【${c.program_name}】${c.titles[0]}（${c.score} 分）`,
    `- 备选标题：${c.titles.slice(1).join(' / ') || '—'}`, `- 开头钩子：${c.hook}`, `- 角度：${c.angle}｜时长 ${c.dur}`, `- 结构：${c.struct}`,
    `- 分项：${Object.entries(c.parts).map(([k, v]) => `${k} ${v}`).join(' · ')}${c.missing.length ? `｜缺：${c.missing.join('、')}` : ''}`, ''))
  return L.join('\n')
}

// ---- CLI：node src/engine.js run | topics [key...] | show
if (import.meta.url === `file://${process.argv[1]}`) {
  const c = resolveConfig(await readJ(path.join(DEFAULT_CONFIG.dataDir, 'config.json'), {}))
  const [cmd = 'run', ...rest] = process.argv.slice(2)
  if (cmd === 'run') console.log(toMarkdown(await runRadar(c, { onLog: m => console.error(m) })))
  else if (cmd === 'show') console.log(toMarkdown(await loadDay(c, rest[0])))
  else if (cmd === 'topics') console.log(topicsMarkdown(await makeTopics(c, { keys: rest.length ? rest : null })))
}
