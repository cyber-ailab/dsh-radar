// dsh-radar · 排序：相关度过滤 + 热度/增速/新鲜度打分 + 分栏
// 分数 = 100 × R × √fresh × (0.45·热度百分位 + 0.35·增速百分位 + 0.20·互动率百分位)

export const DEFAULT_KEYWORDS = {
  strong: String.raw`(?<![A-Za-z])(AI|AIGC|AGI|GPT|LLM|Agent|RAG|MCP)(?![A-Za-z])|人工智能|大模型|智能体|机器人|具身|芯片|算力|GPU|英伟达|NVIDIA|OpenAI|ChatGPT|Claude|Anthropic|Gemini|DeepSeek|豆包|Kimi|千问|Qwen|通义|智谱|MiniMax|Sora|Seedance|可灵|即梦|Midjourney|Stable Diffusion|ComfyUI|diffusion|transformer|LoRA|agentic|copilot|text-to-video|text-to-image|TTS|speech|voice|whisper|embedding|reasoning|multimodal`,
  mid: String.raw`上市|IPO|融资|估值|裁员|收购|开源|open.?source|benchmark|论文|arXiv|Series [A-F]|workflow|自动化|教程|实测`,
}

const ZONES = {
  tools: { title: 'AI 工具与开源', desc: '新模型、新仓库：能不能拿来用' },
  global: { title: '海外热议', desc: 'Hacker News / YouTube 上正在讨论的' },
  cn: { title: '国内热榜', desc: 'B站排行里与 AI/科技相关的作品' },
}

const num = v => (Number.isFinite(+v) ? +v : 0)
const heatOf = m => num(m.view) * 0.02 + num(m.like) + num(m.comment) * 2 + num(m.share) * 3 + num(m.coin) + num(m.score) * 5 + num(m.stars) * 4 + num(m.download) * 0.01 + num(m.trending) * 3
const ageH = p => (p ? Math.max(0.5, (Date.now() - Date.parse(p)) / 36e5) : null)

function pct(arr) {
  const s = [...arr].sort((a, b) => a - b)
  return v => (s.length <= 1 ? 0.5 : s.filter(x => x < v).length / (s.length - 1))
}

// 刷星诱饵仓库（"xxx-win"/破解/激活器/外挂），GitHub 搜索里很常见
export const SPAM_NAME = /-(win|windows|pc|mac|crack|free|pro)$|-(win|pc)-/i
export const SPAM = /on Windows 1[01]|crack|keygen|activat(or|ion)|license key|cheat|aimbot|uncensored|auto-?complet|free download|unlocker|executor|spoofer|injector/i

export function relevance(it, kw) {
  if (it.platform === 'GitHub' && (SPAM_NAME.test(it.key) || SPAM.test(it.title))) return 0
  const t = `${it.title} ${(it.tags || []).join(' ')} ${it.summary || ''}`
  if (kw.strongRx.test(t)) return 1
  if (kw.midRx.test(t)) return 0.6
  return it.zone === 'tools' ? 0.5 : 0   // 工具源本身就是 AI 相关，兜底 0.5
}

/** prev: 上次快照 {key: heat}，用于增速（两次快照差分）；首见用生命周期均速 */
export function rank(items, { keywords = DEFAULT_KEYWORDS, prev = {}, topN = 8, maxAgeDays = 7 } = {}) {
  const kw = { strongRx: new RegExp(keywords.strong, 'i'), midRx: new RegExp(keywords.mid, 'i') }
  const rows = []
  for (const it of items) {
    const R = relevance(it, kw)
    if (R <= 0) continue
    const h = ageH(it.published)
    if (h !== null && h > maxAgeDays * 24) continue
    const heat = heatOf(it.metrics || {})
    const p = prev[it.key]
    const vel = p && p.heat !== undefined && p.at ? Math.max(0, (heat - p.heat) / Math.max(0.5, (Date.now() - p.at) / 36e5)) : heat / (h || 24)
    const base = num(it.metrics?.view) || num(it.metrics?.download) || 0
    const er = base ? (num(it.metrics?.like) + num(it.metrics?.comment)) / base : null
    rows.push({ ...it, R, heat, vel, er, age_h: h })
  }
  const out = {}
  for (const z of Object.keys(ZONES)) {
    const zr = rows.filter(r => r.zone === z)
    const ph = pct(zr.map(r => r.heat)), pv = pct(zr.map(r => r.vel)), pe = pct(zr.filter(r => r.er !== null).map(r => r.er))
    for (const r of zr) {
      const fresh = r.age_h === null ? 0.6 : Math.max(0.05, 1 - r.age_h / (maxAgeDays * 24))
      const parts = r.er === null ? (0.45 * ph(r.heat) + 0.35 * pv(r.vel)) / 0.8 : 0.45 * ph(r.heat) + 0.35 * pv(r.vel) + 0.2 * pe(r.er)
      r.score = Math.round(100 * r.R * Math.sqrt(fresh) * parts * 10) / 10
      r.badge = r.age_h !== null && r.age_h <= 36 && pv(r.vel) >= 0.8 ? '📈增速' : ph(r.heat) >= 0.9 ? '🔥爆款' : r.age_h !== null && r.age_h <= 48 ? '🆕新' : ''
    }
    const perAuthor = {}, perPlat = {}
    out[z] = {
      key: z, ...ZONES[z],
      items: zr.sort((a, b) => b.score - a.score).filter(r => (perAuthor[r.author] = (perAuthor[r.author] || 0) + 1) <= 2 && (perPlat[r.platform] = (perPlat[r.platform] || 0) + 1) <= Math.ceil(topN * 0.6)).slice(0, topN),
    }
  }
  return out
}
