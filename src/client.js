// dsh-radar · 浏览器侧：左栏入口「每日雷达」+ 主区面板
// 加载方式与官方插件一致：window.__ModuleLoader__.load({id, factory(require)})，React 由 DSH 提供
window.__ModuleLoader__.load({ id: 'dsh-radar', factory: (require) => {
  const React = require('react')
  const h = React.createElement
  const { useState, useEffect, useCallback } = React

  const api = async (p, opt) => { const r = await fetch('/dsh-radar' + p, opt); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j }
  const post = (p, body) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  const fmt = n => (!n ? '' : n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : String(Math.round(n)))
  const metrics = m => [['view', '播放'], ['like', '赞'], ['comment', '评'], ['score', '分'], ['stars', '★'], ['download', '下载']].filter(([k]) => m && m[k]).map(([k, l]) => `${l} ${fmt(m[k])}`).join(' · ')

  function Icon() {
    return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' },
      h('circle', { cx: 12, cy: 12, r: 9 }), h('circle', { cx: 12, cy: 12, r: 5 }), h('path', { d: 'M12 12 L19 5' }), h('circle', { cx: 12, cy: 12, r: 1.2, fill: 'currentColor' }))
  }

  function Item({ it, picked, onPick }) {
    return h('label', { className: 'rdr-item' + (picked ? ' on' : '') },
      h('input', { type: 'checkbox', checked: picked, onChange: () => onPick(it.key) }),
      h('div', { className: 'rdr-item-main' },
        h('div', { className: 'rdr-item-title' }, it.badge ? h('span', { className: 'rdr-badge' }, it.badge) : null,
          h('a', { href: it.link, target: '_blank', rel: 'noreferrer', onClick: e => e.stopPropagation() }, it.title)),
        h('div', { className: 'rdr-item-meta' }, [it.platform, it.author, metrics(it.metrics)].filter(Boolean).join(' · '))),
      h('div', { className: 'rdr-score' }, it.score))
  }

  function Topics({ r, onSend }) {
    if (!r) return null
    const bg = r.background
    return h('section', { className: 'rdr-topics' },
      h('div', { className: 'rdr-formula' }, r.formula.expr),
      h('div', { className: 'rdr-bg' },
        [['事件', bg.E.map(e => e.text)], ['人物/公司', bg.P.map(a => a.name)], ['关键词', bg.K.map(a => a.name)], ['话题', bg.T.map(a => a.name)], ['共振', bg.resonance]]
          .map(([k, v]) => h('div', { key: k }, h('b', null, k), ' ', v.length ? v.join('、') : '—'))),
      r.candidates.map((c, i) => h('div', { key: i, className: 'rdr-card' },
        h('div', { className: 'rdr-card-head' }, h('span', { className: 'rdr-prog' }, c.program_name), h('span', { className: 'rdr-card-score' }, c.score + ' 分')),
        h('div', { className: 'rdr-card-title' }, c.titles[0]),
        c.titles.length > 1 ? h('div', { className: 'rdr-card-alt' }, '备选：' + c.titles.slice(1).join(' / ')) : null,
        h('div', { className: 'rdr-card-line' }, h('b', null, '开头钩子 '), c.hook),
        h('div', { className: 'rdr-card-line' }, h('b', null, '结构 '), c.struct),
        h('div', { className: 'rdr-parts' }, Object.entries(c.parts).map(([k, v]) => h('span', { key: k }, h('i', { style: { width: Math.round(v * 100) + '%' } }), k + ' ' + v))),
        h('button', { className: 'rdr-btn', onClick: () => onSend(c, r) }, '交给 AI 完善成选题卡 →'))))
  }

  function Panel({ begin }) {
    const [data, setData] = useState(null), [picked, setPicked] = useState(new Set()), [topics, setTopics] = useState(null)
    const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [showLogin, setShowLogin] = useState(false), [cfg, setCfg] = useState(null)
    const load = useCallback(async (date) => { try { setData(await api('/day' + (date ? '?date=' + date : ''))); setCfg(await api('/config')) } catch (e) { setErr(String(e.message || e)) } }, [])
    useEffect(() => { load() }, [load])
    useEffect(() => {
      if (!data?.running) return
      const t = setInterval(async () => { const s = await api('/status'); setData(d => ({ ...d, log: s.log, running: s.running })); if (!s.running) { clearInterval(t); load() } }, 1500)
      return () => clearInterval(t)
    }, [data?.running, load])
    const refresh = async () => { setErr(''); await post('/refresh'); setData(d => ({ ...(d || {}), running: true, log: [] })) }
    const pick = k => setPicked(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
    const gen = async () => { setBusy(true); setErr(''); try { setTopics(await post('/topics', { date: data?.doc?.date, keys: [...picked] })) } catch (e) { setErr(String(e.message || e)) } setBusy(false) }
    const send = (c, r) => begin(`请加载 daily-radar 技能，把下面这张粗筛选题卡完善成可以直接开工的选题：3 个标题（≤20 字）、开头 3 秒台词、分段大纲（带时码）、需要核实的事实和去哪查。只用素材里出现的事实。\n\n【${c.program_name}】${c.titles.join(' / ')}\n钩子：${c.hook}\n结构：${c.struct}\n槽位：E=${c.slots.E} P=${c.slots.P} K=${c.slots.K} T=${c.slots.T}\n共振：${r.background.resonance.join('、')}\n素材：\n${c.sources.map(s => `- [${s.platform}] ${s.title} ${s.link}`).join('\n')}`)
    const doc = data?.doc
    return h('section', { className: 'rdr' },
      h('header', { className: 'rdr-head' },
        h('div', { className: 'rdr-title' }, h(Icon), h('span', null, '每日雷达'), doc ? h('span', { className: 'rdr-date' }, doc.date) : null,
          h('span', { className: 'rdr-mode ' + (cfg?.mode || 'anonymous') }, cfg?.mode === 'login' ? '登录模式' : '免登录')),
        h('div', { className: 'rdr-actions' },
          data?.dates?.length > 1 ? h('select', { value: doc?.date || '', onChange: e => load(e.target.value) }, data.dates.map(d => h('option', { key: d, value: d }, d))) : null,
          h('button', { className: 'rdr-btn ghost', onClick: () => setShowLogin(v => !v) }, '登录设置'),
          h('button', { className: 'rdr-btn', disabled: data?.running, onClick: refresh }, data?.running ? '抓取中…' : '刷新雷达'))),
      showLogin ? h(Login, { cfg, onSaved: c => { setCfg(x => ({ ...x, ...c })); setShowLogin(false) } }) : null,
      data?.running ? h('pre', { className: 'rdr-log' }, (data.log || []).join('\n') || '开始抓取…') : null,
      err ? h('div', { className: 'rdr-err' }, err) : null,
      !doc && !data?.running ? h('div', { className: 'rdr-empty' }, h('p', null, '还没有日报。点「刷新雷达」，从 Hacker News、Hugging Face、GitHub、B站、YouTube 抓今天的 AI 热点（免登录，约 10 秒）。')) : null,
      doc ? h('div', { className: 'rdr-body' },
        h('div', { className: 'rdr-zones' }, doc.zones.map(z => h('section', { key: z.key, className: 'rdr-zone' },
          h('h3', null, z.title, h('small', null, z.desc)),
          z.items.length ? z.items.map(it => h(Item, { key: it.key, it, picked: picked.has(it.key), onPick: pick })) : h('div', { className: 'rdr-empty' }, '今日无达标')))),
        h('aside', { className: 'rdr-side' },
          h('div', { className: 'rdr-basket' },
            h('b', null, '选题篮 ', picked.size),
            h('span', null, picked.size ? '已选，点下面生成' : '勾选左边的条目（不选=各栏前 2 条）'),
            h('button', { className: 'rdr-btn', disabled: busy, onClick: gen }, busy ? '生成中…' : '生成创意话题'),
            picked.size ? h('button', { className: 'rdr-btn ghost', onClick: () => setPicked(new Set()) }, '清空') : null),
          h(Topics, { r: topics, onSend: send }),
          h('div', { className: 'rdr-foot' }, `素材 ${doc.total} 条 → 上榜 ${doc.kept} 条 · `,
            Object.entries(doc.sources).map(([k, s]) => h('span', { key: k, className: s.ok ? 'ok' : 'bad', title: s.error || '' }, `${s.ok ? '✓' : '✗'}${k} `))))) : null)
  }

  function Login({ cfg, onSaved }) {
    const [gh, setGh] = useState(''), [bili, setBili] = useState(''), [msg, setMsg] = useState('')
    const save = async () => { const r = await post('/login', { githubToken: gh, biliSessdata: bili }); setMsg('已保存'); onSaved(r) }
    return h('div', { className: 'rdr-login' },
      h('p', null, '默认免登录就能用。想要更高的抓取额度，可以填你自己的凭据（只存在本机 ', h('code', null, cfg?.configFile || '~/.dsh-radar/config.json'), '，权限 600，只读使用，不会上传）：'),
      h('label', null, 'GitHub Token（可选，提高 GitHub 搜索限额）', h('input', { type: 'password', placeholder: cfg?.login?.github ? '已设置（留空不改）' : 'ghp_...', value: gh, onChange: e => setGh(e.target.value) })),
      h('label', null, 'B站 SESSDATA（可选，只读排行榜）', h('input', { type: 'password', placeholder: cfg?.login?.bilibili ? '已设置（留空不改）' : '浏览器 Cookie 里的 SESSDATA', value: bili, onChange: e => setBili(e.target.value) })),
      h('div', null, h('button', { className: 'rdr-btn', onClick: save }, '保存'), ' ', msg))
  }

  const inject = ['slots', 'uiWorkspace', 'layout']
  async function apply(ctx) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/dsh-radar/style.css'; document.head.append(link)
    ctx.effect(() => () => link.remove())
    const begin = prompt => ctx.uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'keep' })
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-radar', inject: () => ({ begin }) }, Panel))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dsh-radar', order: -90, label: '每日雷达' }, Icon))
  }
  return { inject, apply, Panel }
} })
