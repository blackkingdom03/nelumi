# 电脑版本与验证范围

第一批目标是 Windows x64、Windows ARM64、Mac Intel、Mac Apple Silicon、Linux x64，共八个下载包。当前多平台版本作为 beta 发布，Windows v0.5.0 保留为原稳定版。

## 构建与检查

`desktop-build.yml` 在五类原生 GitHub runner 上执行。手动触发默认只构建；勾选 publish 或推送 `v*-beta.*` 标签才会发布测试版。每组先跑语法与单元测试，再打包并启动实际产物，检查月历、数据写入和本地 OCR。发布任务必须等五组成功，且下载包名称、数量和大小检查通过。

Windows 提供 NSIS 安装包和完整 ZIP，Mac 提供两种 DMG，Linux 提供 AppImage 和 DEB。SHA-256 校验文件随版本发布。未签名，不冒充已经过 Apple 公证或系统认证的版本。

## 系统差异

Windows 继续读取程序旁的 data，避免旧数据丢失。Mac 和 Linux 的程序目录可能只读，因此使用 Electron 的 appData 目录下的 nelumi。开发模式沿用项目内 .profile。

Mac 保留 Dock 入口，并增加系统菜单，以支持 Command+C / V 等操作。Linux 保留任务栏入口，关闭窗口时最小化；开机启动使用当前用户的 XDG autostart，不修改系统服务。AppImage 的启动项指向原始文件，不指向临时挂载目录。

需要继续人工验证：系统通知权限、提醒声音、休眠唤醒、登录后启动、Linux 不同桌面及 Wayland 的窗口行为。运行自动测试不能证明这些场景全部可用。手机端和跨设备自动同步不在本批范围内。

## 参考资料

- [Super Productivity v19.3.1](https://github.com/super-productivity/super-productivity/releases/tag/v19.3.1)：按系统和芯片区分下载；MIT。仅参考发布组织方式，未复制代码。
- [Joplin v3.7.22](https://github.com/laurent22/joplin/releases/tag/v3.7.22)：安装包与便携版分别提供；AGPL-3.0。仅参考，不引入代码。
- [WeekToDo v2.2.0](https://github.com/manuelernestog/weektodo/releases/tag/v2.2.0)：三类桌面系统的发布格式；GPL。仅参考，不引入代码。
- [electron-builder 多平台构建](https://www.electron.build/v26/docs/features/multi-platform-build/)：使用项目已有依赖，按目标系统构建。
- [Electron app API](https://www.electronjs.org/docs/latest/api/app)：数据目录、macOS / Windows 登录启动接口。
- [Freedesktop Desktop Entry](https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html)：Linux Exec 参数转义与启动项格式。

本次没有新增运行时依赖，日历和 OCR 继续使用现有代码及随包资源。
