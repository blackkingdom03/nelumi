# nelumi

一款面向 Windows 的桌面日程工具。把通知、消息或图片粘贴进日历，整理成事项，再用提醒与笔记跟进。

基于 [DeskCal](https://github.com/kangkangStudent/DeskCal) 定制，界面参考 [neisme Calendar](https://github.com/dikafryo/neisme-Calendar)。这是独立维护的衍生项目，不是上述项目的官方版本。

[下载 Windows 便携版](https://github.com/blackkingdom03/nelumi/releases/latest) · [反馈问题](https://github.com/blackkingdom03/nelumi/issues) · [开源来源与署名](THIRD_PARTY_NOTICES.md)

## 功能

- **桌面日历**：月、周与年份浏览，桌面组件、普通窗口、置顶显示，透明度调节。
- **中国日历**：农历、节气、节日，以及已核验年份的放假与补班标记。
- **通知转日程**：从整段中文中提取事项名称、日期、时间和地点；日期、时间与地点在原文中高亮。
- **本地图片识别**：粘贴或选择图片，通过随程序提供的中文、英文 OCR 模型提取文字，再生成日程。
- **重复与提醒**：支持阳历和农历生日、每年重复、提前一周或一天等提醒。生日、重复或带提醒的通知先打开编辑框供检查。
- **活动时间段**：普通连续活动标记开始和结束；识别为每日打卡的活动在活动期内按天安排，报名时间另行标记。
- **查找与整理**：关键词搜索、每天的事项数量、地点预览、完成状态、删除、撤销与重做。
- **通知与笔记**：查看、编辑通知原文，复制全文，打开网址，记录自己的笔记。
- **五种配色**：默认配色、海盐蓝、抹茶绿、藤萝紫、曜石黑。

## 下载与使用

1. 到 [Releases](https://github.com/blackkingdom03/nelumi/releases/latest) 下载 `nelumi-0.5.0-windows-x64.zip`。
2. 将整个压缩包解压到自己有写入权限的文件夹，双击 `nelumi.exe`。请勿在压缩包内直接运行，也不要只移动 EXE。
3. 在消息框粘贴通知，按 **Enter** 或点击“确定”添加；**Shift + Enter** 换行。图片识别完成后先核对文字。
4. 点击事项查看原文、笔记或编辑详情；点击日期上的数量圆圈查看当天的全部事项。

当前便携版面向 Windows 10/11 x64。程序尚未进行代码签名；下载后可使用 Release 中的 SHA-256 校验文件确认文件完整性。

日程提醒需要程序正在运行，电脑关机或程序退出期间不能保证提醒。文字提取和 OCR 都可能出错，重要事项请核对日期、时间、重复规则及地点。

## 数据与隐私

日程及设置保存在程序旁的 `data/` 文件夹，主要数据文件是 `data/deskcal-data.json`。开发模式使用 `.profile/`。通知提取与图片 OCR 在本地执行，不需要配置云端 AI 服务；OCR 模型随程序提供。

更新前退出程序并备份整个 `data/` 文件夹，然后替换程序文件，保留自己的数据。新版本发布包不包含个人日程、笔记或测试账户。

点击外部网址、获取日历资料等操作会访问对应网络服务。提交 Issue 时请使用虚构例子，不要上传自己的数据文件、私人通知或包含个人信息的截图。

## 日历资料的范围

农历与节气使用 `lunar-javascript`，并结合香港天文台的 1901—2100 年历表核对与修正。核验快照和差异记录在 [`audit/calendar-2026-10-22`](audit/calendar-2026-10-22)，来源与适用条款见 [第三方声明](THIRD_PARTY_NOTICES.md)。1901 年初的部分字段核验覆盖有限，报告保留了这一范围。

**放假与补班以国务院办公厅对应年份的公告为准。** 当前随附正式核验资料为 2026 年；能浏览未来年份不等于未来调休安排已经公布。天文台也提示部分远期新月、节气日期可能存在一天差异，因此本项目不承诺所有年份绝对无误。

## 本地开发

需要 Git、Node.js 22 或更新版本，以及 Windows（运行桌面功能时）。

```bash
git clone https://github.com/blackkingdom03/nelumi.git
cd nelumi
npm ci
npm run check
npm test
npm start
```

构建便携版目录：

```bash
npm run dist:portable
```

产物在 `release/win-unpacked/`，发布时应打包整个目录，并确认其中不含运行后生成的 `data/`。Electron 窗口测试可通过 `npm run test:settings`、`npm run test:notebook`、`npm run test:ocr` 等命令运行；这些测试会创建临时测试配置目录。

## 许可证与致谢

应用代码使用 [MIT 许可证](LICENSE)，保留 DeskCal 的原有版权声明。感谢 DeskCal、neisme Calendar、Bootstrap Icons、lunar-javascript、Tesseract.js 及相关数据来源。

OCR 引擎、模型、Electron 和历表数据各有相应许可证或使用条款；本仓库的 MIT 许可证不替代它们。完整出处、版本与复用范围请阅读 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
