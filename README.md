# Mini Player

[中文](#中文) | [English](#english)

---

## 中文

Mini Player 是一个 VS Code 插件，用于在 VS Code 底部面板中播放本地视频。它适合在编辑器内快速预览视频文件，支持字幕、最近播放、快速隐藏、左右位置切换，以及实时播放活动日志。

> 当前版本面向本地使用和开发调试，发布者为 `local`。

### 功能特性

- 在 VS Code 底部面板播放本地视频。
- 支持 MP4 等浏览器原生可播放的视频格式。
- 支持手动加载字幕，也可以自动加载同名字幕。
- 支持 `.srt`、`.vtt`、`.ass`、`.ssa` 字幕文件。
- 支持最近播放列表。
- 支持快速隐藏面板。
- 支持播放器在左侧或右侧布局之间切换。
- 活动日志会输出当前播放进度、剩余时间和当前时间。

### 安装

从源码安装前，先进入项目根目录：

```powershell
git clone https://github.com/Uranus-s/VsCodeMiniPlayer.git
cd VsCodeMiniPlayer
npm install
npm run build
```

打包 VSIX：

```powershell
npx @vscode/vsce package
```

生成的文件通常类似：

```text
mini-player-0.0.1.vsix
```

使用命令安装：

```powershell
code --install-extension .\mini-player-0.0.1.vsix
```

也可以在 VS Code 中手动安装：

1. 打开扩展面板。
2. 点击右上角 `...`。
3. 选择 `Install from VSIX...`。
4. 选择生成的 `.vsix` 文件。
5. 重启 VS Code。

### 使用方法

1. 打开 VS Code 命令面板：`Ctrl+Shift+P`。
2. 运行 `Mini Player: Open Video`。
3. 选择一个本地视频文件。
4. 如需字幕，运行 `Mini Player: Open Subtitle` 并选择字幕文件。
5. 使用 `Mini Player: Toggle Corner Position` 切换播放器左右位置。
6. 使用 `Mini Player: Quick Hide` 快速隐藏面板。

### 命令

| 命令 | 说明 |
| --- | --- |
| `Mini Player: Open Video` | 打开本地视频 |
| `Mini Player: Toggle Panel` | 显示或隐藏 Mini Player 面板 |
| `Mini Player: Quick Hide` | 按配置快速隐藏播放器 |
| `Mini Player: Open Subtitle` | 手动加载字幕文件 |
| `Mini Player: Open Recent` | 打开最近播放的视频 |
| `Mini Player: Toggle Corner Position` | 在左侧和右侧布局之间切换 |

默认快捷键：

| 命令 | Windows/Linux | macOS |
| --- | --- | --- |
| `Mini Player: Quick Hide` | `Ctrl+Alt+H` | `Cmd+Alt+H` |

### 配置项

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `miniPlayer.hideBehavior` | `pauseAndHide` | 快速隐藏时的行为，可选 `pauseAndHide` 或 `keepPlayingAndHide` |
| `miniPlayer.cornerPosition` | `right` | 播放器靠左或靠右，可选 `left` 或 `right` |
| `miniPlayer.defaultVolume` | `0.7` | 默认音量，范围 `0` 到 `1` |
| `miniPlayer.autoLoadMatchingSubtitle` | `true` | 是否自动加载视频旁边的同名字幕 |
| `miniPlayer.recentLimit` | `10` | 最近播放记录数量，范围 `1` 到 `50` |

### 字幕支持

Mini Player 支持以下字幕格式：

- `.srt`
- `.vtt`
- `.ass`
- `.ssa`

SRT 会转换为 WebVTT。VTT 会在加载前规范化。ASS/SSA 提供实用转换支持，适合常见对白、时间轴、文本、颜色、字号和描边。

复杂 ASS/SSA 动画、卡拉 OK 时间效果和精确字体匹配不属于当前版本保证范围。

### 本地开发

安装依赖：

```powershell
npm install
```

构建：

```powershell
npm run build
```

运行测试：

```powershell
npm test
```

仅运行 TypeScript 检查：

```powershell
npm run compile
```

VS Code 调试：

1. 用 VS Code 打开项目目录。
2. 按 `F5` 启动 Extension Host。
3. 在新窗口中运行 `Mini Player: Open Video`。

### 项目结构

```text
.
├── media/              # Webview 样式、脚本和图标
├── src/                # 插件源码
│   ├── subtitles/      # 字幕检测、匹配和转换
│   └── webview/        # Webview HTML 生成
├── test/               # 测试文件
├── AGENTS.md           # 协作代理说明
├── package.json        # VS Code 插件清单和 npm 脚本
└── README.md
```

### 许可

当前仓库未声明 License。发布或公开分发前建议补充许可证文件。

---

## English

Mini Player is a VS Code extension for playing local videos inside a compact bottom panel. It is designed for quick video preview workflows inside the editor, with subtitle support, recent files, quick hide, left/right positioning, and a real playback activity log.

> The current version is intended for local use and development. The publisher is `local`.

### Features

- Play local videos in the VS Code bottom panel.
- Support browser-native video formats such as MP4.
- Load subtitles manually or automatically load matching same-name subtitles.
- Support `.srt`, `.vtt`, `.ass`, and `.ssa` subtitle files.
- Keep a recent video list.
- Quickly hide the player panel.
- Switch the player layout between the left and right side.
- Log current playback progress, remaining time, and current clock time.

### Installation

From the repository root:

```powershell
git clone https://github.com/Uranus-s/VsCodeMiniPlayer.git
cd VsCodeMiniPlayer
npm install
npm run build
```

Package the extension as a VSIX:

```powershell
npx @vscode/vsce package
```

The generated file usually looks like:

```text
mini-player-0.0.1.vsix
```

Install it with:

```powershell
code --install-extension .\mini-player-0.0.1.vsix
```

You can also install it manually in VS Code:

1. Open the Extensions view.
2. Click the `...` menu in the top-right corner.
3. Choose `Install from VSIX...`.
4. Select the generated `.vsix` file.
5. Restart VS Code.

### Usage

1. Open the Command Palette with `Ctrl+Shift+P`.
2. Run `Mini Player: Open Video`.
3. Select a local video file.
4. To load subtitles, run `Mini Player: Open Subtitle` and select a subtitle file.
5. Use `Mini Player: Toggle Corner Position` to switch between left and right layout.
6. Use `Mini Player: Quick Hide` to hide the panel quickly.

### Commands

| Command | Description |
| --- | --- |
| `Mini Player: Open Video` | Open a local video |
| `Mini Player: Toggle Panel` | Show or hide the Mini Player panel |
| `Mini Player: Quick Hide` | Quickly hide the player according to settings |
| `Mini Player: Open Subtitle` | Load a subtitle file manually |
| `Mini Player: Open Recent` | Open a recent video |
| `Mini Player: Toggle Corner Position` | Switch between left and right layout |

Default keybinding:

| Command | Windows/Linux | macOS |
| --- | --- | --- |
| `Mini Player: Quick Hide` | `Ctrl+Alt+H` | `Cmd+Alt+H` |

### Settings

| Setting | Default | Description |
| --- | --- | --- |
| `miniPlayer.hideBehavior` | `pauseAndHide` | Behavior when quick hide is triggered. Use `pauseAndHide` or `keepPlayingAndHide` |
| `miniPlayer.cornerPosition` | `right` | Pin the player to the `left` or `right` side |
| `miniPlayer.defaultVolume` | `0.7` | Default video volume from `0` to `1` |
| `miniPlayer.autoLoadMatchingSubtitle` | `true` | Automatically load a same-name subtitle next to the selected video |
| `miniPlayer.recentLimit` | `10` | Number of recent entries to keep, from `1` to `50` |

### Subtitle Support

Mini Player supports:

- `.srt`
- `.vtt`
- `.ass`
- `.ssa`

SRT files are converted to WebVTT. VTT files are normalized before loading. ASS/SSA files have practical conversion support for common dialogue timing, readable text, colors, font sizes, and outlines.

Complex ASS/SSA animations, karaoke timing effects, and exact font matching are outside the current version guarantee.

### Development

Install dependencies:

```powershell
npm install
```

Build:

```powershell
npm run build
```

Run tests:

```powershell
npm test
```

Run TypeScript checks only:

```powershell
npm run compile
```

Debug in VS Code:

1. Open this repository in VS Code.
2. Press `F5` to launch the Extension Host.
3. Run `Mini Player: Open Video` in the new window.

### Project Structure

```text
.
├── media/              # Webview styles, scripts, and icon
├── src/                # Extension source code
│   ├── subtitles/      # Subtitle detection, matching, and conversion
│   └── webview/        # Webview HTML generation
├── test/               # Tests
├── AGENTS.md           # Agent collaboration notes
├── package.json        # VS Code extension manifest and npm scripts
└── README.md
```

### License

This repository does not currently declare a license. Add a license file before publishing or public distribution.
