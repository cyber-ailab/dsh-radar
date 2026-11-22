// dsh-radar · DSH 宿主侧插件
//   工具：radar_daily（刷新/读取每日雷达）、radar_topics（按选题公式出选题卡）
//   技能：daily-radar（告诉模型怎么用这两个工具、怎么把粗筛卡完善成可开工选题）
//   路由：/dsh-radar/*（给前端面板读数据、触发刷新、出选题）
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { resolveConfig, runRadar, loadDay, listDates, makeTopics, toMarkdown, topicsMarkdown, metricsText, DEFAULT_CONFIG } from './engine.js'
import { PROGRAMS } from './topics.js'

export const name = 'dsh-radar'
export const inject = ['tools', 'webServer']

const text = s => [{ type: 'text', text: s }]

export async function apply(ctx, userConfig = {}) {
  const fileCfgPath = path.join(userConfig.dataDir || DEFAULT_CONFIG.dataDir, 'config.json')
  let fileCfg = {}
  try { fileCfg = JSON.parse(await readFile(fileCfgPath, 'utf8')) } catch { /* 首次运行没有 */ }
  let cfg = resolveConfig({ ...fileCfg, ...userConfig })
  let running = null, log = []

  async function refresh(only) {
    if (running) return running
    log = []
    running = runRadar(cfg, { only, onLog: m => log.push(`${new Date().toTimeString().slice(0, 8)} ${m}`) }).finally(() => { running = null })
    return running
  }

  // ---------------- 工具 ----------------
  ctx.tools.register({
    name: 'radar_daily',
    description: '每日雷达：从公开源（Hacker News、Hugging Face 趋势、GitHub 新星、B站排行、YouTube 频道）抓取 AI/科技相关的热门内容，按热度·增速·新鲜度打分，分「AI 工具与开源 / 海外热议 / 国内热榜」三栏出榜。refresh=true 时现抓（约 5–15 秒），否则读最近一次的日报。返回 Markdown 日报，每条带 key，可以把 key 传给 radar_topics。',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        refresh: { type: 'boolean', description: '是否立即重新抓取。默认 false：读最近一次日报，没有日报时自动抓取。' },
        date: { type: 'string', description: '读历史某天的日报，格式 YYYY-MM-DD。' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true, properties: { date: { type: 'string' }, markdown: { type: 'string' } } },
      render: (_a, v) => text(v.markdown),
    },
    timeoutMs: 90_000,
    async execute(args) {
      let doc = args.refresh ? await refresh() : await loadDay(cfg, args.date)
      if (!doc) doc = await refresh()
      const md = toMarkdown(doc) + '\n\n条目 key（传给 radar_topics.keys）：\n' +
        doc.zones.flatMap(z => z.items.map(it => `- ${it.key} ｜ ${it.title.slice(0, 40)}`)).join('\n')
      return { date: doc.date, markdown: md }
    },
  })

  ctx.tools.register({
    name: 'radar_topics',
    description: '生成创意话题：把雷达里选中的条目按「选题组装公式」粗筛成选题卡（选题 = 大背景(事件×人物×关键词×话题×信号) ⊗ 栏目透镜 ⊕ 差异化角度；选题分 = 共振·新鲜·栏目适配·差异空间）。keys 不给时取各栏前 2 条。programs 指定栏目 id（默认按适配度自动挑 3 个）。返回 Markdown 选题卡；需要成稿级标题和大纲时，按 daily-radar 技能里的说明继续完善。',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        keys: { type: 'array', items: { type: 'string' }, description: '日报条目 key 列表（radar_daily 返回里有）。' },
        programs: { type: 'array', items: { type: 'string' }, description: `栏目 id，可选：${Object.keys(cfg.programDefs).join(', ')}` },
        date: { type: 'string', description: '用哪天的日报，默认最新。' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true, properties: { markdown: { type: 'string' } } },
      render: (_a, v) => text(v.markdown),
    },
    async execute(args) {
      const r = await makeTopics(cfg, { date: args.date, keys: args.keys, programs: args.programs })
      return { markdown: topicsMarkdown(r) }
    },
  })

  // ---------------- 技能 ----------------
  const skillText = await readFile(new URL('../skills/daily-radar.md', import.meta.url), 'utf8').catch(() => '')
  const regSkill = c => c.skills.registerProvider(() => {
    const cand = { name: 'daily-radar', description: '每日雷达与创意选题：用户想看今天 AI/科技圈有什么热点、想找视频/文章选题、想把热点变成可开工的选题卡时加载。',
      provider: 'dsh-radar', source: 'bundled', rank: 600, locator: null, invocation: { modelInvocable: true, userInvocable: true } }
    return { name: 'dsh-radar', list: () => Promise.resolve([cand]), get: () => Promise.resolve({ ...cand, content: skillText.replace(/^---[\s\S]*?---\n/, '') }) }
  })
  if (typeof ctx.inject === 'function') ctx.inject(['skills'], inner => regSkill(inner))   // skills 服务可选：可用时再注册
  else if (ctx.skills) regSkill(ctx)

  // ---------------- 前端路由 ----------------
  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
  const readBody = req => new Promise((ok, bad) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}) } catch (e) { bad(e) } }); req.on('error', bad) })
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/dsh-radar',
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const p = url.pathname.slice('/dsh-radar'.length) || '/'
      try {
        if (p === '/client.js' || p === '/style.css') {
          const f = new URL('.' + p, import.meta.url)
          res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/css' }); res.end(await readFile(f)); return
        }
        if (p === '/day' && req.method === 'GET') {
          const doc = await loadDay(cfg, url.searchParams.get('date') || null)
          return json(res, 200, { doc, dates: await listDates(cfg), running: !!running, log, mode: cfg.mode })
        }
        if (p === '/refresh' && req.method === 'POST') { refresh().catch(() => {}); return json(res, 202, { started: true }) }
        if (p === '/status' && req.method === 'GET') return json(res, 200, { running: !!running, log, mode: cfg.mode })
        if (p === '/topics' && req.method === 'POST') {
          const b = await readBody(req)
          const r = await makeTopics(cfg, b)
          return json(res, 200, { ...r, markdown: topicsMarkdown(r) })
        }
        if (p === '/config' && req.method === 'GET')
          return json(res, 200, { mode: cfg.mode, sources: cfg.sources, programs: Object.entries(cfg.programDefs).map(([id, v]) => ({ id, name: v.name, need: v.need, dur: v.dur })),
            login: { github: !!cfg.creds.githubToken, bilibili: !!cfg.creds.biliSessdata }, dataDir: cfg.dataDir, configFile: fileCfgPath })
        if (p === '/login' && req.method === 'POST') {   // 登录模式：只保存用户自己粘贴的凭据到本机配置文件
          const b = await readBody(req)
          const login = { ...(fileCfg.login || {}) }
          for (const k of ['githubToken', 'biliSessdata']) if (typeof b[k] === 'string') login[k] = b[k].trim()
          fileCfg = { ...fileCfg, login }
          await mkdir(path.dirname(fileCfgPath), { recursive: true })
          await writeFile(fileCfgPath, JSON.stringify(fileCfg, null, 2), { mode: 0o600 })
          cfg = resolveConfig({ ...fileCfg, ...userConfig })
          return json(res, 200, { mode: cfg.mode, login: { github: !!cfg.creds.githubToken, bilibili: !!cfg.creds.biliSessdata } })
        }
        json(res, 404, { error: 'not found' })
      } catch (e) { json(res, 500, { error: String(e.message || e) }) }
    },
  }))
}
export { metricsText, PROGRAMS }
