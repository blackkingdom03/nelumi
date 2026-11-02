# 网页预览

[完整日历](https://blackkingdom03.github.io/nelumi/#overview) · [当日事项](https://blackkingdom03.github.io/nelumi/#day) · [个性化设置](https://blackkingdom03.github.io/nelumi/#settings)

页面和截图使用虚构日程，不包含个人通知、邮箱或桌面文件。网页数据只在内存中保存，刷新后恢复示例。网页用于查看界面；桌面提醒和图片识别请使用 Windows 版。

预览基于本仓库的日历界面生成，沿用项目的许可证和[第三方声明](../THIRD_PARTY_NOTICES.md)。三张截图由项目维护者提供，内容来自这份示例页面。

修改界面后，在仓库根目录运行以下命令，重新生成 `docs/index.html`：

```bash
npm ci
node scripts/build-showcase.cjs
```

GitHub Pages 从 `main` 分支的 `docs` 目录发布。截图保存在 `docs/images/`，README 中的图片可以直接打开对应预览。
