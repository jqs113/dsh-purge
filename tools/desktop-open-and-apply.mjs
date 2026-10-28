/**
 * 一次性工具：把密封桌面端的 app.asar 解开成 resources/app，并按本仓库的补丁表清洗。
 * 不排重启（scheduleSwap:false），由调用方验证后再单独排。
 *
 * 用法（必须带 DSH_SURFACE=desktop）：
 *   $env:DSH_SURFACE="desktop"; $env:DSH_HOME="D:\DSH\home-desktop"
 *   node tools/desktop-open-and-apply.mjs [--schedule-swap]
 */
import * as core from "../lib/core.js";
import * as reapply from "../lib/reapply.js";

const scheduleSwap = process.argv.includes("--schedule-swap");

if (String(process.env.DSH_SURFACE || "").toLowerCase() !== "desktop") {
  console.error("refusing to run: set DSH_SURFACE=desktop");
  process.exit(2);
}

const started = Date.now();
const handoff = core.sealedAsarHandoff();
console.log("handoff:", JSON.stringify(handoff));
if (!handoff) {
  console.error("sealedAsarHandoff 为空：定位不到官方 exe / app.asar");
  process.exit(3);
}

const result = await reapply.reapplyInstalled({ preserveClientBundles: false, scheduleSwap: false });
console.log("reapplyInstalled:", JSON.stringify(result));

const aiBase = core.findAiBase();
console.log("aiBase:", aiBase);
console.log("host:", JSON.stringify(core.hostRelease(aiBase)));
console.log("asarStillSealed:", core.desktopAsarStillSealed());
console.log("elapsedMs:", Date.now() - started);

if (scheduleSwap && result.ok) {
  const swapped = core.scheduleSealedDesktopRestart(handoff);
  console.log("scheduled swap:", JSON.stringify(swapped));
}

process.exit(result.ok ? 0 : 1);
