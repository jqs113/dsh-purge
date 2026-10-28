# tools/

维护用的小工具，不进 npm 包（`package.json` 的 `files` 里没有 `tools`）。

| 脚本 | 用途 |
|---|---|
| `patch-compat-report.mjs` | 只读：把 `lib/core.js` 里每条补丁的锚点拿到宿主原文上试一遍，报 `ANCHOR_OK` / `MARKER_ONLY` / `ANCHOR_LOST` / `NO_TARGET_FILE`。换宿主版本先跑这个。 |
| `apply-scratch.mjs` | 把补丁真的打到一棵**拷贝**出来的宿主树上，输出 applied / skipped / `pattern_not_found` 统计。 |
| `desktop-open-and-apply.mjs` | 密封桌面端专用：解开 `app.asar` → `resources/app` 并按补丁表清洗（走 `reapplyInstalled`）。 |
| `desktop-swap-now.mjs` | 换包收尾：延迟若干秒后「杀本安装进程 → `app.asar` 改名 `.bak` → 重新拉起」。走**计划任务**，因为宿主里 `spawn(powershell)` 有起不来的机器。 |

前两个只接受显式路径，不写真实安装；后两个是桌面端真实操作，会用**绝对路径写死本机安装位置**，别在别的机器上直接跑。

## 换宿主版本时的用法

```powershell
# 1. 从官方安装里把 @deepseek-ai 包树解出来（app.asar 里的 dsh/node_modules/@deepseek-ai）
#    再把其中 @deepseek-ai 目录当成 DSH_BASE。

# 2. 只读体检
$env:DSH_BASE = "D:\somewhere\dsh\node_modules\@deepseek-ai"
node tools/patch-compat-report.mjs

# 3. 打补丁演练（务必拷一份再打）
$env:DSH_BASE = "D:\scratch\copy\dsh\node_modules\@deepseek-ai"
node tools/apply-scratch.mjs $env:DSH_BASE
```

判读：`ANCHOR_LOST` 说明宿主改了措辞，那条补丁会静默变成 `skipped`；`pattern_not_found` 说明补丁有 `strictFiles` 且原文对不上，界面上会显红。报告写在 `tools/out/`（已 ignore）。

在 0.2.1-rc.3 上预期还剩三条 `ANCHOR_LOST`，都不是问题：

- **#21 / #80**：只做迁移（把老版本插件自己写进去的东西再撤掉）。干净宿主上本来就没有那段文本，没有锚点才是对的。
- **#88**：锚的是 **#87** 写出来的代码，按顺序应用后才会命中。单条体检会把它报成 lost，实际 apply 里是 applied。

`NO_TARGET_FILE` 一般是正常的：liangshen、hooks-claude-code/codex、pi-ai、desktop-shell 这些都是「这台宿主没装」才没有文件。
