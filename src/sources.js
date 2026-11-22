// dsh-radar · 数据源（免登录为默认；登录模式只读用户自己提供的凭据，不做任何模拟登录/绕过）
// 每个 source: { id, name, zone, login?: 'optional'|'required', fetch(ctx) -> Item[] }
// Item: { key, title, link, author?, platform, zone, metrics:{view,like,comment,stars,score,...}, published?: ISO, summary?, tags?[] }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 dsh-radar/0.1'

/** 带重试的请求：网络抖动（fetch failed / 超时 / 5xx / 429）最多重试 2 次，指数退避 */
async function req(url, init, timeout, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise(r => setTimeout(r, 700 * 2 ** (i - 1)))
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) })
      if (r.ok) return r
      last = new Error(`HTTP ${r.status} ${url.slice(0, 80)}`)
      if (r.status < 500 && r.status !== 429) break
    } catch (e) { last = new Error(`${e.cause?.code || e.name || ''} ${e.message}`.trim()) }
  }
  throw last
}
export async function getJSON(url, { headers = {}, timeout = 15000 } = {}) {
  return (await req(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } }, timeout)).json()
}
export async function getText(url, { headers = {}, timeout = 15000 } = {}) {
  return (await req(url, { headers: { 'User-Agent': UA, ...headers } }, timeout)).text()
}
const iso = t => (t ? new Date(t).toISOString() : undefined)
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)

/** Hacker News 首页（Algolia 公共 API） */
const hackernews = {
  id: 'hackernews', name: 'Hacker News', zone: 'global',
  async fetch() {
    try {
      const d = await getJSON('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50')
      return d.hits.map(h => ({
        key: 'hn:' + h.objectID, title: h.title, link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        discuss: `https://news.ycombinator.com/item?id=${h.objectID}`, author: h.author, platform: 'Hacker News', zone: 'global',
        metrics: { score: h.points, comment: h.num_comments }, published: iso(h.created_at),
      }))
    } catch {   // 备用：官方 Firebase API（取前 40 条）
      const ids = (await getJSON('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 40)
      const rows = await Promise.all(ids.map(id => getJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)))
      return rows.filter(Boolean).map(h => ({
        key: 'hn:' + h.id, title: h.title, link: h.url || `https://news.ycombinator.com/item?id=${h.id}`, author: h.by, platform: 'Hacker News', zone: 'global',
        metrics: { score: h.score, comment: h.descendants }, published: iso(h.time * 1000),
      }))
    }
  },
}

/** Hugging Face 趋势模型 */
const huggingface = {
  id: 'huggingface', name: 'Hugging Face 趋势', zone: 'tools',
  async fetch() {
    const d = await getJSON('https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=40&full=false')
    return d.map(m => ({
      key: 'hf:' + m.id, title: m.id, link: `https://huggingface.co/${m.id}`, author: m.id.split('/')[0], platform: 'Hugging Face', zone: 'tools',
      metrics: { like: m.likes, download: m.downloads, trending: m.trendingScore }, published: iso(m.createdAt),
      tags: [m.pipeline_tag, m.library_name].filter(Boolean),
    }))
  },
}

/** GitHub 近 N 天新建、AI 相关、按星排序（可选 GITHUB_TOKEN 提高限额） */
const github = {
  id: 'github', name: 'GitHub 新星', zone: 'tools', login: 'optional',
  async fetch({ creds }) {
    const q = encodeURIComponent(`created:>${daysAgo(4)} (ai OR llm OR agent OR video OR diffusion) in:name,description,topics`)
    const headers = creds.githubToken ? { Authorization: `Bearer ${creds.githubToken}` } : {}
    const d = await getJSON(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=40`, { headers })
    return d.items.map(r => ({
      key: 'gh:' + r.full_name, title: `${r.full_name}：${r.description || ''}`.slice(0, 160), link: r.html_url, author: r.owner?.login,
      platform: 'GitHub', zone: 'tools', metrics: { stars: r.stargazers_count, fork: r.forks_count }, published: iso(r.created_at),
      tags: [r.language, ...(r.topics || []).slice(0, 4)].filter(Boolean),
    }))
  },
}

/** B站 全站排行榜（公共接口；登录模式带用户自己的 SESSDATA，只读） */
const bilibili = {
  id: 'bilibili', name: 'B站排行', zone: 'cn', login: 'optional',
  async fetch({ creds }) {
    const headers = { Referer: 'https://www.bilibili.com/', ...(creds.biliSessdata ? { Cookie: `SESSDATA=${creds.biliSessdata}` } : {}) }
    const out = [], errs = []
    for (const [i, rid] of [0, 36, 188].entries()) {   // 全站 / 知识 / 科技；间隔请求，避免触发风控
      if (i) await new Promise(r => setTimeout(r, 800))
      try {
        const d = await getJSON(`https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`, { headers })
        if (d?.code !== 0) { errs.push(`rid${rid}: code ${d?.code} ${d?.message || ''}`.trim()); continue }
        for (const v of d.data?.list || []) out.push({
          key: 'bili:' + v.bvid, title: v.title, link: `https://www.bilibili.com/video/${v.bvid}`, author: v.owner?.name, platform: 'B站', zone: 'cn',
          metrics: { view: v.stat?.view, like: v.stat?.like, comment: v.stat?.reply, coin: v.stat?.coin, share: v.stat?.share },
          published: iso(v.pubdate * 1000), summary: v.desc?.slice(0, 120), tags: [v.tname].filter(Boolean),
        })
      } catch (e) { errs.push(`rid${rid}: ${e.message}`) }
    }
    if (!out.length) throw new Error('B站排行暂时取不到（' + (errs.join('；') || '空列表') + '），可能被限流，稍后再刷新')
    return out
  },
}

/** YouTube 频道 RSS（免登录；频道列表可配置） */
const youtube = {
  id: 'youtube', name: 'YouTube 订阅', zone: 'global',
  async fetch({ config }) {
    const chans = config.youtubeChannels || []
    const out = []
    await Promise.all(chans.map(async ({ id, name }) => {
      try {
        const x = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
        for (const e of x.split('<entry>').slice(1, 8)) {
          const g = re => (e.match(re) || [])[1]
          const vid = g(/<yt:videoId>([^<]+)/)
          out.push({
            key: 'yt:' + vid, title: decode(g(/<title>([^<]+)/) || ''), link: `https://www.youtube.com/watch?v=${vid}`, author: name || g(/<name>([^<]+)/),
            platform: 'YouTube', zone: 'global', published: g(/<published>([^<]+)/),
            metrics: { view: +(g(/<media:statistics views="(\d+)"/) || 0), like: +(g(/<media:starRating count="(\d+)"/) || 0) },
          })
        }
      } catch { /* 单个频道失败不影响 */ }
    }))
    return out
  },
}
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export const SOURCES = { hackernews, huggingface, github, bilibili, youtube }
