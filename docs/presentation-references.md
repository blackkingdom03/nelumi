# 项目介绍的参考与取舍

核对日期：2026-11-02。目标是帮助初次访问者看懂 nelumi 的用途、看到实际使用例子，并找到下载入口。

## 参考项目

| 项目 | GitHub Star | 近期发布附件下载计数 | 借鉴的表达与组织方式 |
| --- | ---: | ---: | --- |
| [Super Productivity](https://github.com/super-productivity/super-productivity) | 23,341 | 190,990 | 开头说清用途、本地处理与隐私；把下载入口提前；从用户得到的帮助讲功能 |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | 78,079 | 77,033 | 用简短定位建立认知，随后给出安装入口；用户使用与开发说明分开 |
| [Flow Launcher](https://github.com/Flow-Launcher/Flow.Launcher) | 15,941 | 640,368 | Windows 下载方式明确，功能按场景分组，版本与文档入口容易找到 |

数据口径：Star 来自 GitHub REST 仓库接口。下载计数是 `/releases?per_page=10` 返回的近期 10 个 Release 中，程序包/压缩包附件的 `download_count` 合计；包含返回的预发布版本，不含 GitHub 自动生成的源码压缩包和商店等其他渠道。这些数字不是去重用户数、不是项目历史总下载量；三个项目的版本时间跨度不同，不能据此给产品质量或增长速度排名。重复下载、更新下载以及不同平台的附件均可能计入。

来源接口：

- [Super Productivity 仓库资料](https://api.github.com/repos/super-productivity/super-productivity) · [近期 Release](https://api.github.com/repos/super-productivity/super-productivity/releases?per_page=10)
- [AppFlowy 仓库资料](https://api.github.com/repos/AppFlowy-IO/AppFlowy) · [近期 Release](https://api.github.com/repos/AppFlowy-IO/AppFlowy/releases?per_page=10)
- [Flow Launcher 仓库资料](https://api.github.com/repos/Flow-Launcher/Flow.Launcher) · [近期 Release](https://api.github.com/repos/Flow-Launcher/Flow.Launcher/releases?per_page=10)

这些页面只能支持对公开介绍方式和下载计数的观察，不能证明它们的成功由某一种文案造成。

## nelumi 的选择

以 **“把群消息和通知图片，变成桌面上的日程。”** 作为主介绍，突出已经实现的文字/图片输入与日程整理。农历生日、中国日历、本地处理作为进一步选择理由。

首页顺序：一句话用途与下载入口 → 日常场景 → 三个可复制的消息示例 → 桌面功能 → 上手步骤 → 常见问题 → 数据、来源与开发说明。

没有采用全能工作平台定位，因为当前产品重点是 Windows 个人日程；也没有把配色作为首要卖点，因为它不足以解释通知处理的用途。

只参考信息组织方法，文案重新撰写。未复制这些项目的品牌图、截图、宣传文案或代码，不把它们的下载量、用户评价用作 nelumi 的背书。首页保留已有程序图标；没有制作或发布包含私人通知的截图。

## 表达边界

- 使用“提取、预填、核对”描述本地规则，不宣传为大模型语义理解或百分之百准确。
- 明确图片 OCR 和文字提取在本机执行，同时说明外部网址和日历资料更新会联网。
- 农历、节气及调休的核验范围保留可追溯说明；浏览未来年份不等于未来调休已经公布。
- 不承诺关机提醒、云同步、移动端、永远免费或未经测量的性能。
- 宣传示例已对照当前解析器运行；原有的许可证和上游署名继续保留。
