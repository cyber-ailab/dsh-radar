# Changelog

## 0.1.0 - 2026-11-23

首个公开版本。配套教程视频：[B站 BV1wjyDz6EV6](https://www.bilibili.com/video/BV1wjyDz6EV6)，图文教程：[公众号](https://mp.weixin.qq.com/s/CS6VA3q8zYFkcbXQwk-mNg)。

- 九个免登录数据源：抖音热榜、微博热搜、今日头条热榜、百度热搜、B站排行、Hacker News、Hugging Face 趋势、GitHub 新星、YouTube 频道。
- 按热度、增速、新鲜度打分，分「AI 工具与开源 / 海外热议 / 国内热榜」三栏。
- 选题组装公式，规则粗筛成选题卡，一键交给 DSH 里的模型完善。
- 单个源抓取失败时用 6 小时内缓存兜底；过滤刷星仓库与 uncensored 变体；B站风控识别。
- 可选登录模式（GitHub Token、B站 SESSDATA），只读使用。
