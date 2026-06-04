# AGENTS.md

## 项目概览

这个仓库是一个名为 Mini Player 的 VS Code 插件。它可以在 VS Code 的紧凑 Webview 面板中播放本地视频，支持字幕、最近播放、快速隐藏、左右角落定位，以及真实的播放活动日志。

插件范围应保持为本地、用户主动控制的迷你播放器。不要加入欺骗性行为、伪造终端活动、外部隐蔽浮层、进程隐藏，或用于误导他人的机制。低干扰能力应限制在明确的用户控制内，例如紧凑布局、快速隐藏、左右位置切换，以及真实播放日志。

## 初始化

所有命令都从仓库根目录执行：

```powershell
npm install
```

在 VS Code 中调试：

1. 用 VS Code 打开这个文件夹。
2. 按 `F5`，如果出现调试器选择，选择 VS Code Extension Host 相关配置。
3. 在新打开的 Extension Host 窗口中，通过命令面板运行插件命令。

## 常用命令

```powershell
npm test
npm run build
npm run compile
```

`npm test` 用于运行当前项目的单元和静态测试。完成代码改动前应运行 `npm run build`，因为它会打包插件并执行 TypeScript 检查。

## 打包安装到 VS Code

从项目根目录执行：

```powershell
npm install
npm run build
npx @vscode/vsce package
```

成功后会生成类似下面的 VSIX 文件：

```text
mini-player-0.0.1.vsix
```

使用命令安装到当前 VS Code：

```powershell
code --install-extension .\mini-player-0.0.1.vsix
```

如果 `code` 命令不可用，可以在 VS Code 中手动安装：

1. 打开扩展面板。
2. 点击右上角 `...`。
3. 选择 `Install from VSIX...`。
4. 选择生成的 `mini-player-0.0.1.vsix` 文件。

安装后重启 VS Code，按 `Ctrl+Shift+P` 搜索 `Mini Player: Open Video` 即可打开本地视频。

## 手动验证

行为或 Webview 改动后，需要在 Extension Host 中验证：

- `Mini Player: Open Video` 可以打开普通本地 MP4 文件。
- 视频画面、声音和控制条正常工作。
- `Mini Player: Toggle Panel` 可以打开和隐藏面板。
- `Mini Player: Quick Hide` 符合 `miniPlayer.hideBehavior` 设置。
- `Mini Player: Toggle Corner Position` 可以在左侧和右侧布局之间切换。
- 播放时活动日志会输出当前播放进度、剩余时间和当前时间。
- `Mini Player: Open Subtitle` 可以加载支持的字幕文件。
- `Mini Player: Open Recent Video` 符合最近播放列表行为。

## 关键文件

- `package.json`：VS Code 插件清单、命令、快捷键、设置项和脚本。
- `src/extension.ts`：插件激活、命令注册、视频/字幕/最近播放流程，以及配置更新。
- `src/playerPanel.ts`：`WebviewViewProvider`、面板生命周期、Webview 消息、显示等待逻辑和角落位置同步。
- `src/config.ts`：插件设置读取、解析和默认值。
- `src/recentStore.ts`：最近播放文件持久化。
- `src/subtitles/`：字幕匹配、解析和规范化。
- `src/webview/html.ts`：Webview HTML、CSP、nonce、资源 URI 和初始状态注入。
- `media/player.css`：面板布局和响应式样式。
- `media/player.js`：Webview 运行时代码、视频事件、字幕处理、工具栏动作和活动日志输出。
- `test/`：针对清单、配置、存储、字幕、Webview HTML、CSS 和播放器运行时行为的测试。

## 布局规则

Webview 布局刻意使用 CSS Grid，让播放器和活动日志能填满可用面板区域，不留下无意义空白。

- 保持 `.player-shell` 作为主两行网格：内容行加工具栏行。
- 保持 `.activity-log` 和 `.video-frame` 位于内容行。
- 保持 `.toolbar` 位于工具栏行。
- 左右切换时改变列位置，不要复制 DOM。
- 保持 `.video-frame` 为定位容器，并让 `video` 元素绝对定位填满它。
- 如果修改布局行为，需要同步更新 `test/playerStyle.test.ts`。

## Webview 规则

- 插件媒体资源使用 `webview.asWebviewUri`。
- `localResourceRoots` 要与 Webview 需要读取的本地文件保持一致。
- CSP 逻辑保持在 `src/webview/html.ts` 中。
- 不要加入不受控的内联脚本，沿用当前基于 nonce 的脚本模式。
- Webview 消息需要在 `src/playerPanel.ts` 和 `media/player.js` 中保持类型和处理逻辑清晰。

## 字幕说明

插件支持实用的本地字幕工作流：

- SRT 文件会转换为 WebVTT。
- VTT 文件会规范化后交给浏览器播放。
- ASS/SSA 文件提供实用转换支持。

复杂 ASS 特性，例如动画和卡拉 OK 效果，不要求完整保留，除非专门实现并补充测试。

## 测试策略

优先为改动补充聚焦测试：

- 插件清单或命令改动：更新 `test/extensionManifest.test.ts`。
- 设置和默认值解析改动：更新 `test/config.test.ts`。
- 最近播放行为：更新 `test/recentStore.test.ts`。
- 字幕解析或匹配：更新 `test/subtitles.test.ts`。
- Webview HTML、CSP 或资源改动：更新 `test/webviewHtml.test.ts`。
- 播放器运行时文本、事件或日志行为：更新 `test/playerScript.test.ts`。
- CSS 布局行为：更新 `test/playerStyle.test.ts`。

完成代码改动前运行 `npm test` 和 `npm run build`。

## Git 和工作区规则

- 保留用户已有改动，不要回退无关工作。
- 不要使用破坏性 git 命令，除非用户明确要求。
- `node_modules/`、`dist/`、`.superpowers/` 和 `.worktrees/` 是被忽略的本地或生成目录。
- 提交应保持聚焦，不要把无关清理和功能改动混在一起。

## 当前产品边界

可接受的产品范围是用户明确控制的 VS Code 本地迷你播放器：

- 打开本地视频。
- 加载同名或手动选择的字幕。
- 使用紧凑底部面板。
- 切换左侧或右侧位置。
- 通过命令隐藏或显示面板。
- 展示真实播放活动。

超出这些边界的改动，应先讨论再实现。
