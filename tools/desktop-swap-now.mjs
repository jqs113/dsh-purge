/**
 * 密封桌面端的收尾：把 app.asar 改名让路，然后重新拉起客户端。
 *
 * 为什么不直接 spawn：
 *   实测在官方桌面宿主里，插件 `spawn(powershell, {detached:true})` 这条后台路径
 *   在这台机器上没落地（.ps1 写出来了，进程没起来），asar 始终没让路。
 *   计划任务由 Task Scheduler 拉起，脱离宿主进程树，稳定可用。
 *
 * 用法：
 *   node tools/desktop-swap-now.mjs [delaySeconds]
 *
 * 执行顺序（到点后）：
 *   1. 杀本安装目录下的所有进程（Stop-HarnessInstall）
 *   2. robocopy app.asar.unpacked → resources/app
 *   3. app.asar → app.asar.bak
 *   4. Start-Process 重新拉起 exe
 *   5. 删掉自己的计划任务
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as desktop from "../lib/desktop.js";

const EXE = "C:\\Users\\10035\\AppData\\Local\\Programs\\DeepSeek Harness\\DeepSeek Harness.exe";
const ASAR = path.join(path.dirname(EXE), "resources", "app.asar");
const SWAP = path.join(os.tmpdir(), `dsh-purge-asar-swap-manual-${process.pid}.ps1`);
const WRAP = path.join(os.tmpdir(), "dshpurge-swap-task.ps1");
const TASK = "dshpurge-swap";
const delay = Number(process.argv[2] || 20);

if (!fs.existsSync(ASAR)) {
  console.log("app.asar 已不在，无需换包：", ASAR);
  process.exit(0);
}
if (!fs.existsSync(desktop.appDirForExecutable(EXE))) {
  console.log("resources/app 不存在，先跑 tools/desktop-open-and-apply.mjs");
  process.exit(2);
}

// 直接复用插件里那份换包脚本，保证和 /purge apply 的行为一致。
const swapBody = desktop.asarSwapScript();
fs.writeFileSync(SWAP, swapBody, "ascii");

fs.writeFileSync(
  WRAP,
  [
    `Start-Sleep -Seconds ${delay}`,
    `& "${SWAP}" -WaitPid 0 -AsarPath "${ASAR}" -ExePath "${EXE}"`,
    `schtasks /delete /tn ${TASK} /f | Out-Null`,
    "",
  ].join("\r\n"),
  "ascii",
);

execFileSync("schtasks", ["/create", "/tn", TASK, "/tr", `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${WRAP}"`, "/sc", "once", "/st", "23:58", "/f"], { stdio: "inherit" });
execFileSync("schtasks", ["/run", "/tn", TASK], { stdio: "inherit" });
console.log(`已排定：${delay}s 后换包并重启客户端（计划任务 ${TASK}）`);
