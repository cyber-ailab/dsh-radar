// dsh-radar · 选题组装公式（规则粗筛，零成本）
//   选题 = 大背景(E事件 × P人物/公司 × K关键词/产品 × T话题 × S信号) ⊗ 栏目透镜 ⊕ 差异化角度
//   选题分 = 100 × (0.30·共振 + 0.25·新鲜增速 + 0.25·栏目适配 + 0.20·差异空间)
// 需要成稿级标题/大纲时，把粗筛卡交给 DSH 里的模型（skill: daily-radar 说明了怎么做）。

const E_ = [
  // 人物
  ['奥特曼', '人物', 'Sam Altman|Altman|奥特曼'], ['黄仁勋', '人物', 'Jensen Huang|黄仁勋'], ['马斯克', '人物', 'Elon Musk|Musk|马斯克'],
  ['梁文锋', '人物', '梁文锋'], ['辛顿', '人物', 'Hinton|辛顿'], ['雷军', '人物', '雷军'], ['扎克伯格', '人物', 'Zuckerberg|扎克伯格'],
  ['李飞飞', '人物', 'Fei-Fei Li|李飞飞'], ['杨植麟', '人物', '杨植麟'], ['Karpathy', '人物', 'Karpathy|卡帕西'], ['阿莫迪', '人物', 'Amodei|Dario|阿莫迪'],
  ['哈萨比斯', '人物', 'Hassabis|哈萨比斯'], ['吴恩达', '人物', 'Andrew Ng|吴恩达'], ['杨立昆', '人物', 'LeCun|杨立昆'],
  // 公司
  ['OpenAI', '公司', 'OpenAI'], ['英伟达', '公司', 'Nvidia|NVIDIA|英伟达'], ['DeepSeek', '公司', 'DeepSeek|深度求索'], ['Anthropic', '公司', 'Anthropic'],
  ['谷歌', '公司', 'Google|DeepMind|谷歌'], ['微软', '公司', 'Microsoft|微软'], ['苹果', '公司', 'Apple|苹果公司'], ['Meta', '公司', '(?<![A-Za-z])Meta(?![A-Za-z])'],
  ['特斯拉', '公司', 'Tesla|特斯拉'], ['字节', '公司', 'ByteDance|字节'], ['腾讯', '公司', '腾讯|Tencent'], ['阿里', '公司', '阿里|Alibaba'], ['华为', '公司', '华为|Huawei'],
  ['小米', '公司', '小米|Xiaomi'], ['月之暗面', '公司', '月之暗面|Moonshot'], ['智谱', '公司', '智谱|Zhipu'], ['MiniMax', '公司', 'MiniMax|海螺'], ['xAI', '公司', 'xAI|Grok'],
  ['Hugging Face', '公司', 'Hugging ?Face'], ['Mistral', '公司', 'Mistral'],
  // 产品
  ['ChatGPT', '产品', 'ChatGPT|GPT-?\\d'], ['Claude', '产品', 'Claude'], ['Gemini', '产品', 'Gemini'], ['Sora', '产品', 'Sora'], ['豆包', '产品', '豆包|Doubao'],
  ['即梦', '产品', '即梦'], ['可灵', '产品', '可灵|Kling'], ['Seedance', '产品', 'Seedance'], ['Veo', '产品', 'Veo ?\\d'], ['Midjourney', '产品', 'Midjourney'],
  ['千问', '产品', '千问|通义|Qwen'], ['DeepSeek Harness', '产品', 'DeepSeek Harness|DSH'], ['Suno', '产品', 'Suno'], ['ComfyUI', '产品', 'ComfyUI'],
  ['Cursor', '产品', '(?<![A-Za-z])Cursor(?![A-Za-z])'], ['Llama', '产品', 'Llama'], ['Flux', '产品', '(?<![A-Za-z])FLUX|Flux(?![A-Za-z])'],
  // 概念
  ['AGI', '概念', '(?<![A-Za-z])AGI(?![A-Za-z])|通用人工智能'], ['机器人', '概念', '机器人|具身|robot|humanoid'], ['AI泡沫', '概念', '泡沫|bubble'],
  ['算力', '概念', '算力|数据中心|data ?center|GPU'], ['芯片', '概念', '芯片|半导体|chip'], ['Agent', '概念', '(?<![A-Za-z])Agents?(?![A-Za-z])|智能体|agentic'],
  ['开源', '概念', '开源|open.?source|open.?weight'], ['AI视频', '概念', 'text-to-video|video generation|AI视频|视频生成|AI短剧|AI ?MV'],
  ['语音', '概念', 'TTS|speech|voice|语音|配音'], ['AI安全', '概念', 'AI安全|alignment|对齐|safety'], ['编程', '概念', 'coding|编程|程序员|code agent|vibe coding'],
]
export const ENT = E_.map(([c, t, p]) => [c, t, new RegExp(p, 'i')])
const HASHTAG = /#([^\s#]{2,20})/g, BRACKET = /【([^】]{2,16})】/g, ACTIVITY = /大赛|计划|公开赛|制作人|挑战|赛季|征稿|活动/

/** 默认栏目透镜（通用版；用户可在 config.programs 里换成自己的栏目） */
export const PROGRAMS = {
  explain: { name: '2分钟讲透一个AI概念', need: 'K', dur: '2:00', angle: '类比讲透 + 最新案例', struct: '问题钩子 → 一个生活类比 → 今天的真实案例 → 一句话总结',
    hook: '你天天听到的{K}，到底是什么？', tpl: ['{K}到底是什么？从{E}讲起', '2 分钟看懂{K}：为什么{T}', '{E}，用一个比喻讲清{K}'] },
  news: { name: '30秒AI快讯', need: 'E', dur: '0:30', angle: '信息密度 + 一句判断', struct: '3 件事（每件 ≤8 秒：事实+数字）→ 一句判断 → 引流',
    hook: '昨天 AI 圈发生了三件事', tpl: ['30 秒｜{E}', '昨日 AI 大事：{E_s}', '{T}、{K}、{P}：昨天的 AI 圈'] },
  person: { name: '人物/公司深扒', need: 'P', dur: '5–8min', angle: '反常识 + 人生/公司转折', struct: '0:20 抛题 → 起点 → 三个转折 → 2/5 处反转 → 回答 → 引流',
    hook: '大家以为{P}…其实…', tpl: ['{P}：{E}之后，{angle_s}', '为什么是{P}？{K}背后的故事', '{P}的 3 次豪赌：从{K}到{T}'] },
  test: { name: 'AI工具实测', need: 'K', dur: '1–3min', angle: '同题对比 + 打分', struct: '成品先看 → 同一任务分屏对比 → 3 维打分 → 成本与结论',
    hook: '同一个任务，{K}能打几分？', tpl: ['同一个任务，{K}能打几分？', '{E_s}之后，我拿{K}做了实测', '{K}一键出片：3 步做出{T}'] },
  fun: { name: 'AI整活/翻车', need: 'T', dur: '0:60', angle: '人 vs AI 的荒诞反转', struct: '我让 AI 做 X → 一本正经翻车 → 升级指令 → 更离谱 → 收尾梗',
    hook: '我让 AI {E_s}，结果…', tpl: ['当我试图让 AI {E_s}', '我让{K}做{T}，它疯了', '{T}：AI 翻车实录'] },
}

export const FORMULA = {
  expr: '选题 = 大背景(E事件 × P人物 × K关键词 × T话题 × S信号) ⊗ 栏目透镜 ⊕ 差异化角度',
  score: '选题分 = 100 × (0.30·共振 + 0.25·新鲜增速 + 0.25·栏目适配 + 0.20·差异空间)',
}
const NEED_ZH = { P: '人物/公司', K: '关键词/产品', E: '新鲜事件', T: '话题/情绪' }

const clean = t => (t || '').replace(/#\S+/g, '').replace(/【[^】]*】/g, '').replace(/\s+/g, ' ').trim().replace(/^[ ，,。|｜-]+|[ ，,。|｜-]+$/g, '')
const isZh = t => { t = (t || '').replace(/\s/g, ''); return !!t && [...t].filter(c => c >= '\u4e00' && c <= '\u9fff').length / t.length >= 0.3 }
const same = (a, b) => { if (!a || !b) return false; a = a.replace(/\s/g, '').toLowerCase(); b = b.replace(/\s/g, '').toLowerCase(); return a.includes(b) || b.includes(a) }
const short = (t, n = 18) => { const s = t.split(/[！!？?。|｜:：]/)[0].trim() || t; return s.length <= n ? s : s.slice(0, n) + '…' }
/** 截短：中文按字，英文在词边界断开 */
const cut = (t, n) => {
  if (t.length <= n) return t
  if (isZh(t)) return t.slice(0, n) + '…'
  const w = t.slice(0, n + 1).replace(/\s+\S*$/, '')
  return (w.length >= n * 0.5 ? w : t.slice(0, n)) + '…'
}
const freshOf = h => (h === null || h === undefined ? 0.5 : Math.max(0, Math.min(1, 1 - h / 168)))

/** 事件短语：中文标题取首句；GitHub/HF 取「项目名：一句话简介」里的项目名 + 简介要点；英文标题保留原句（≤40 字符） */
export function eventOf(it) {
  const t0 = clean(it.title)
  if (isZh(t0)) return short(t0)
  if (isZh(it.why || '')) return short(it.why)
  const m = t0.match(/^([\w.-]+)\/([\w.-]+)\s*[：:]\s*(.*)$/)     // owner/repo：description
  if (m) { const desc = m[3].split(/[.!?。]/)[0].trim(); return desc ? `${m[2]}（${desc.length > 46 ? desc.slice(0, 46) + '…' : desc}）` : m[2] }
  const hf = t0.match(/^[\w.-]+\/([\w.-]+)$/)
  if (hf) return hf[1] + ' 模型'
  return t0.length > 60 ? t0.slice(0, 60) + '…' : t0
}

export function dimsOf(it) {
  const text = [it.title, it.why, it.summary].filter(Boolean).join(' ')   // 平台分区标签不参与实体识别（如 B站「可灵」分区会污染主角）
  const P = [], K = [], T = []
  for (const [c, t, rx] of ENT) if (rx.test(text)) (t === '人物' || t === '公司' ? P : K).push([c, t])
  for (const m of (it.title || '').matchAll(HASHTAG)) if (!K.some(x => x[0] === m[1])) K.push([m[1], '标签'])
  for (const m of (it.title || '').matchAll(BRACKET)) if (ACTIVITY.test(m[1])) T.push([m[1], '活动'])
  for (const tg of it.tags || []) if (tg && !K.some(x => same(x[0], tg)) && K.length < 5 && /[\u4e00-\u9fff]/.test(tg)) T.push([tg, '分区'])
  const E = eventOf(it)
  return { E, P: P.slice(0, 4), K: K.slice(0, 5), T: T.slice(0, 3) }
}

function fitOf(pg, bg) {
  const has = { P: bg.P.length > 0, K: bg.K.length > 0, E: bg.E.length > 0, T: bg.T.length > 0 }
  let f = has[pg.need] ? 0.55 : 0.1
  f += 0.15 * Object.values(has).filter(Boolean).length / 4
  if (pg.need === 'P' && bg.P[0]?.type === '人物') f += 0.2
  if (pg.need === 'E' && bg.S.freshest_h !== null && bg.S.freshest_h <= 36) f += 0.2
  if (pg.need === 'K' && bg.K.filter(k => k.type === '产品').length >= 2) f += 0.15
  return Math.min(1, f)
}

function candOf(pk, pg, bg, bd, done, focus) {
  const P = bg.P.filter(a => !focus || a.name === focus).length ? bg.P.filter(a => !focus || a.name === focus) : bg.P
  const p = P[0]?.name ?? null
  const prods = bg.K.filter(x => ['产品', '概念'].includes(x.type) && !(p && same(p, x.name)))
  const k = (prods[0] || bg.K.find(x => !(p && same(p, x.name))))?.name ?? null
  const used = [p, k].filter(Boolean)
  const t = bg.T.find(x => !used.some(u => same(x.name, u)))?.name ?? bg.K.find(x => !used.some(u => same(x.name, u)))?.name ?? null
  // 事件要和槽里的人物/关键词来自同一条素材，否则「谷歌：某个无关仓库之后…」这种错配
  const anchor = focus || p || k
  const rxA = anchor && ENT.find(x => x[0] === anchor)?.[2]
  const evA = rxA ? bg.E.find(x => rxA.test(`${x.title || ''} ${x.text || ''}`)) : null
  let e = (pg.need === 'E' ? bg.E[0] : evA)?.text ?? null
  if (!e && pg.need !== 'P') e = bg.E[0]?.text ?? null
  const ptype = P[0]?.type || ''
  const eShort = e ? cut(e.replace(/（.*$/, ''), 24) : null
  const slot = { P: p || k || '这家公司', K: k || p || '这项技术', T: t || eShort || '这个热点', E: eShort || t || '这件事', E_s: eShort || (t || '').slice(0, 16),
    angle_s: ptype === '公司' ? '它做对了哪件事' : '他做对了哪件事' }
  const real = { P: p, K: k, T: t, E: eShort, E_s: eShort || t }
  const titles = []
  for (const tp of pg.tpl) {
    const keys = [...tp.matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(x => x in real)
    const vals = keys.map(x => real[x])
    if (vals.some(v => v === null || v === undefined) || vals.some((a, i) => vals.slice(i + 1).some(b => same(a, b)))) continue
    titles.push(tp.replace(/\{(\w+)\}/g, (_, x) => slot[x] ?? ''))
  }
  const ents = [...bg.P, ...bg.K, ...bg.T]
  const maxh = Math.max(1, ...ents.map(a => a.heat))
  const reson = Math.min(1, bg.resonance.length * 0.18 + (Math.max(0, ...ents.map(a => a.heat)) / maxh) * 0.3 + 0.12 * bg.S.platforms.length)
  const fresh = freshOf(bg.S.freshest_h) * 0.6 + Math.min(1, bg.S.max_heat / 100) * 0.4
  const fit = fitOf(pg, bg)
  const hits = Object.fromEntries([p, k, t].filter(x => x && done[x]).map(x => [x, done[x]]))
  const diff = Math.max(0.1, 1 - 0.35 * Object.keys(hits).length)
  const score = Math.round(1000 * (0.30 * reson + 0.25 * fresh + 0.25 * fit + 0.20 * diff)) / 10
  const missing = ({ P: bg.P, K: bg.K, E: bg.E, T: bg.T })[pg.need].length ? [] : [NEED_ZH[pg.need]]
  return {
    program: pk, program_name: pg.name, focus: focus || null, titles: titles.length ? titles : [`${pg.name}：${slot.E}`],
    hook: pg.hook.replace(/\{(\w+)\}/g, (_, x) => slot[x] ?? ''), angle: pg.angle, struct: pg.struct, dur: pg.dur,
    slots: { E: e, P: p, K: k, T: t }, missing, done_hits: hits, score,
    parts: { 共振: +reson.toFixed(2), 新鲜增速: +fresh.toFixed(2), 栏目适配: +fit.toFixed(2), 差异空间: +diff.toFixed(2) },
    sources: bd.slice(0, 10).map(it => ({ title: it.title, link: it.link, platform: it.platform })),
  }
}

/** basket: 选中的素材；pool: 今日全部素材（算共振）；programs: 栏目 id 列表；done: {实体:[做过的说明]} */
export function fuse(basket, pool, { programs = null, programDefs = PROGRAMS, done = {} } = {}) {
  const heat = {}, plats = {}, cnt = {}
  for (const it of pool) {
    const d = dimsOf(it), h = Math.min(1, (it.score ?? 30) / 100)
    for (const [c] of [...d.P, ...d.K, ...d.T]) { heat[c] = (heat[c] || 0) + h; (plats[c] ||= new Set()).add(it.platform); cnt[c] = (cnt[c] || 0) + 1 }
  }
  const bd = basket.map(it => ({ ...it, _d: dimsOf(it) }))
  const agg = { P: {}, K: {}, T: {} }
  for (const it of bd) for (const dim of ['P', 'K', 'T']) for (const [c, t] of it._d[dim]) {
    const a = agg[dim][c] ||= { name: c, type: t, n: 0, heat: +(heat[c] || 0).toFixed(2), platforms: [...(plats[c] || [])].filter(Boolean).sort(), in_pool: cnt[c] || 0 }
    a.n++
  }
  const rk = dim => Object.values(agg[dim]).sort((a, b) => (b.n * 2 + b.heat + b.platforms.length) - (a.n * 2 + a.heat + a.platforms.length))
  const P = rk('P'), K = rk('K'), T = rk('T')
  const E = bd.filter(it => it._d.E).sort((a, b) => ((b.score || 0) + 40 * freshOf(b.age_h)) - ((a.score || 0) + 40 * freshOf(a.age_h)))
    .map(it => ({ text: it._d.E, title: it.title, link: it.link, platform: it.platform, age_h: it.age_h, score: it.score }))
  const ages = bd.map(it => it.age_h).filter(x => x !== null && x !== undefined)
  const S = { items: bd.length, platforms: [...new Set(bd.map(it => it.platform).filter(Boolean))].sort(),
    max_heat: Math.max(0, ...bd.map(it => it.score || 0)), freshest_h: ages.length ? Math.min(...ages) : null }
  const resonance = [...P, ...K, ...T].filter(a => a.n >= 2 || a.platforms.length >= 2).map(a => a.name).slice(0, 8)
  const bg = { E: E.slice(0, 4), P: P.slice(0, 5), K: K.slice(0, 6), T: T.slice(0, 4), S, resonance }
  let progs = programs?.filter(p => programDefs[p]) || Object.keys(programDefs)
  if (!programs?.length) progs = progs.sort((a, b) => fitOf(programDefs[b], bg) - fitOf(programDefs[a], bg)).slice(0, 3)
  let cands = []
  for (const pk of progs) {
    const pg = programDefs[pk]
    cands.push(candOf(pk, pg, bg, bd, done, null))
    if (pg.need === 'P') for (const a of P.slice(0, 2)) if (a.type === '人物') cands.push(candOf(pk, pg, bg, bd, done, a.name))
  }
  if (!programs?.length) cands = cands.filter(c => !c.missing.length).length ? cands.filter(c => !c.missing.length) : cands
  const seen = new Set(), out = []
  for (const c of cands.sort((a, b) => b.score - a.score)) { if (seen.has(c.titles[0])) continue; seen.add(c.titles[0]); out.push(c) }
  return { formula: FORMULA, background: bg, candidates: out.slice(0, 8), programs: progs }
}
