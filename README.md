# 静时 · JingShi

一款 Windows 桌面自律督促软件。V0.1 MVP 只做一件事：在约定的时间提醒你回到当下，并诚实地记录完成、跳过与延期。

> 完全离线运行，所有计划、记录、设置都只保存在本机。

## 技术栈

- electron-vite 6 + Electron 45 + Vite 8
- Vue 3 `<script setup>` + Vue Router 4
- Pinia 3
- Naive UI 2 + @iconify/vue（本地 Phosphor 图标集）
- lowdb 7（JSON 文件数据库）
- electron-builder + NSIS（Windows x64）

## 环境要求

- Windows 10 / 11
- Node.js 20 或更高版本
- npm 10 或更高版本

## 安装依赖

```bash
npm install
```

如果 Electron 二进制下载失败（`Error: Electron uninstall`），可指定国内镜像后重新执行安装脚本：

```bash
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
node node_modules/electron/install.js
```

`postinstall` 会自动执行 `electron-builder install-app-deps`。

## 开发

```bash
npm run dev
```

启动后：

- 主窗口：今日看板、周视图、执行记录、统计、设置、关于
- 悬浮小组件：独立透明置顶窗口，显示当前任务倒计时
- 托盘：常驻右下角，菜单包含打开主面板、显示/隐藏悬浮窗、暂停所有提醒、今日统计、设置、退出软件

## 类型检查与构建

```bash
npm run typecheck   # 主进程 + 渲染进程类型检查
npm run build       # 生成 out/ 产物
npm start           # 预览已构建产物
```

## 打包 Windows 安装包

```bash
npm run build:win
```

产物输出在 `dist/`，NSIS 安装包名为 `JingShi-Setup-0.1.0.exe`。MVP 阶段未配置代码签名。

如果打包时从 GitHub 下载 Electron / NSIS 资源超时，可在当前终端设置镜像后重新打包：

```bash
# PowerShell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
npx electron-builder --win nsis
```

## 项目结构

```text
├─ resources/                 应用图标（icon.png / icon.ico）
├─ src/
│  ├─ main/                   主进程
│  │  ├─ index.ts             应用入口、单实例、生命周期
│  │  ├─ ipc.ts               IPC 注册与参数校验、CSV / 备份导出
│  │  ├─ tray.ts              托盘菜单
│  │  ├─ db/database.ts       lowdb 封装（plans / records / settings / runtime）
│  │  ├─ services/
│  │  │  ├─ plan-service.ts   计划展开、任务状态、执行记录、统计
│  │  │  └─ scheduler.ts      30 秒轮询调度与提醒（主进程）
│  │  └─ windows/window-manager.ts  主窗口 / 悬浮窗 / 提醒窗口
│  ├─ preload/                contextBridge 白名单 API
│  ├─ renderer/               Vue 渲染进程
│  │  └─ src/
│  │     ├─ views/            今日 / 周 / 记录 / 统计 / 设置 / 关于 / 悬浮窗 / 提醒
│  │     ├─ components/       任务卡片与四类弹窗、柱状图
│  │     ├─ stores/           Pinia：计划、设置、当前任务
│  │     ├─ layouts/          主窗口布局
│  │     ├─ router/           Hash 路由
│  │     └─ styles/           全局浅色 / 深色主题变量
│  └─ shared/                 类型、IPC 通道、日期工具（主进程与渲染进程共用）
├─ electron.vite.config.ts
├─ electron-builder.yml
└─ tsconfig*.json
```

## 数据存储

- 数据库文件：`%APPDATA%\jingshi\jingshi-data.json`（实际路径以「设置 → 数据管理」显示为准）
- 数据表：`plans`（计划）、`records`（执行记录）
- 额外持久化 `settings`（设置）、`runtime`（提前开始 / 暂停 / 延期造成的实际执行窗口）、`meta`（版本信息）
- 导入备份会覆盖当前全部数据；清空数据需要输入“清空”二次确认
- CSV 导出带 UTF-8 BOM，便于 Excel 正确显示中文

## 提醒机制

1. 主进程每 30 秒扫描今日计划，与当前时间比对，自动推导任务状态。
2. 到点后同时触发 Electron 系统通知与独立提醒窗口，避免 Windows 通知被拦截。
3. 用户未开始且 5 分钟后仍未处理时，触发第二次提醒（可在设置中关闭）。
4. 延期会写入一条 `delay` 记录，并整体顺延实际执行窗口，在新时间点再次提醒。
5. 跳过必须填写至少 2 个字的理由，理由会写入 `records.remark`，供复盘。

## 安全与隐私

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- preload 只暴露白名单 API，不暴露原始 `ipcRenderer`
- 禁止新窗口与外部导航；CSP 限制脚本与远程资源
- 不读取其它软件使用情况、不修改 hosts、不拦截网址、不监控进程
- 无任何网络上传

## 开发注意事项

- 调度逻辑只写在主进程，渲染进程不负责计时提醒。
- 任务状态优先依据 `records` 终态，其次依据 `runtime`（暂停 / 延期）与当前时间窗口推导。
- 修改 `shared/types.ts` 中的数据结构时，需同步检查备份校验逻辑（`src/main/ipc.ts`）。
- 渲染进程访问系统能力一律通过 `window.api`，不要在页面里直接使用 Node.js。
- 深色主题通过 CSS 变量与 Naive UI `darkTheme` 双轨切换，新增页面优先复用 `styles/main.css` 中的变量与工具类。
- 开发环境不会写入开机自启；仅打包后的应用会调用 `app.setLoginItemSettings`。
- 关闭主窗口只会隐藏到托盘，只有托盘“退出软件”才会停止调度并销毁窗口。

## V0.1 明确不做

进程监控与查杀、hosts 修改、网址黑名单、软件黑名单、白噪音、奖惩系统、拖拽调整周视图计划。这些属于后续版本。
