# 参与贡献

欢迎提 Issue、PR 和想法。保持小改动、可验证就行。

## 本地开发

```sh
node -v          # 需要 Node 22+
npm test         # 离线单测，必须全绿
npm run radar    # 命令行抓一次，打印今日雷达
npm run pack     # 产出 dsh-radar-<version>.tgz
```

源码零依赖。`src/sources.js` 是数据源，`src/rank.js` 是打分，`src/topics.js` 是选题公式。

## 加一个数据源

1. 在 `src/sources.js` 里按 `Item` 结构写一个 `{ id, name, zone, fetch }`，加进 `SOURCES`。
2. 只用**公开接口**，不做模拟登录、不绕过限制、不抓需要签名的平台。
3. 抓取失败要抛出可读的错误信息，引擎会用 6 小时内的缓存兜底。
4. 在 `tests/plugin.test.js` 里补一条离线用例（用假数据，不联网）。
5. README 的数据源清单和 CHANGELOG 同步更新。

## 提 PR 之前

- `npm test` 通过。
- 不要提交 token、cookie、本机路径、个人账号信息。
- 提交信息写清楚改了什么、为什么。

## 行为准则

友好、讲事实。恶意灌水、人身攻击、要求提供违规抓取方式的 Issue 会直接关闭。
