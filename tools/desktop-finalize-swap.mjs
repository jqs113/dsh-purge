/**
 * 收尾：把当前这份 app.asar 的指纹写成「已解包」，然后安排把 app.asar 改名让路。
 * 用 idle 观察者模式：不主动杀进程，用户退出客户端后助手自动改名并用 resources/app 重新拉起。
 */
import * as core from "../lib/core.js";
import * as extract from "../lib/extract-asar.js";

const handoff = core.sealedAsarHandoff();
if (!handoff?.asar) {
  console.error("no sealed handoff");
  process.exit(2);
}

const aiBase = core.findAiBase();
const identity = extract.asarFileIdentity(handoff.asar);
core.writeUnpackedAsarStamp(identity);

console.log("exe        :", handoff.exe);
console.log("asar       :", handoff.asar);
console.log("aiBase     :", aiBase);
console.log("host       :", JSON.stringify(core.hostRelease(aiBase)));
console.log("stamp      :", JSON.stringify(core.readUnpackedAsarStamp()));
console.log("markersOk  :", core.hostCleanMarkersPresent(aiBase));

const scheduled = core.scheduleSealedDesktopRestart(handoff);
console.log("swap       :", JSON.stringify(scheduled));
console.log("stillSealed:", core.desktopAsarStillSealed());
