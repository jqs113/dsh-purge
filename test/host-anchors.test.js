/**
 * 锁住 0.2.1 宿主里的原文锚点。
 *
 * 这些字符串是从 DSH 0.2.1-rc.3 的真实产物里抄下来的：Web 面身份句和禁令句
 * 搬到了 @deepseek-ai/dsh-harness-dev-context，回退客户端的 clear() 也加了守卫。
 * 宿主再改一次措辞，这里先红，别等到用户在状态面板上看见「跳过」。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PATCHES,
  HOST_SUPPORT,
  applyReplacementsToText,
  hostSupported,
} from "../lib/core.js";

const patchOf = (id) => {
  const patch = ALL_PATCHES.find((p) => p.id === id);
  assert.ok(patch, `patch #${id} missing`);
  return patch;
};

const run = (id, text, fp = "lib/index.js") => applyReplacementsToText(text, patchOf(id), fp);

test("hostSupported 认 0.2.x，不认 0.1.x / 0.3.x", () => {
  assert.equal(hostSupported("0.2.1-rc.3"), true);
  assert.equal(hostSupported("0.2.1-rc.2"), true);
  assert.equal(hostSupported("0.2.0-rc.2"), true);
  assert.equal(hostSupported("0.1.5-rc.1"), false);
  assert.equal(hostSupported("0.3.0-rc.1"), false);
  assert.equal(hostSupported(""), null);
  assert.equal(hostSupported(undefined), null);
  assert.equal(HOST_SUPPORT.tested, "0.2.1-rc.3");
});

test("#32 中性化 harness-dev-context 的 Web 面身份（现行 prompt + 旧段落前缀）", () => {
  const source = [
    "const HARNESS_SOURCE_PROMPT = `The runtime context names the DeepSeek Harness implementation checkout. Use pwd to determine the current working directory.`;",
    "const WEB_SURFACE_PROMPT = `You are interacting with the user through the DeepSeek Harness Web GUI whose URL the runtime context names. When the user refers to \"this page\", they mean this GUI.`;",
    "const LEGACY_SOURCE = {",
    '\tprefix: "The DeepSeek Harness implementation checkout is at ",',
    "};",
    "const LEGACY_WEB_SURFACE = {",
    '\tprefix: "You are interacting with the user through the DeepSeek Harness Web GUI at ",',
    "};",
  ].join("\n");

  const once = run(32, source);
  assert.equal(once.changed, true);
  assert.ok(!once.text.includes("through the DeepSeek Harness Web GUI"));
  assert.ok(!once.text.includes("names the DeepSeek Harness implementation checkout"));
  assert.ok(once.text.includes("through the local web GUI whose URL the runtime context names."));
  assert.ok(once.text.includes('prefix: "You are interacting with the user through the local web GUI at ",'));

  const twice = run(32, once.text);
  assert.equal(twice.changed, false, "#32 不能每次 apply 再叠一层");
});

test("#32 认得现行 web-app 的 DSH_WEB_URL description", () => {
  const source =
    '\t\t\tvariables: { [DSH_WEB_URL]: { description: "Advertised URL of the DeepSeek Harness Web GUI serving this session." } },';
  const once = run(32, source);
  assert.equal(once.changed, true);
  assert.ok(once.text.includes("Advertised URL of the web GUI serving this session."));
  assert.ok(once.text.includes("[dsh-purge] web surface identity neutralized"));
  assert.equal(run(32, once.text).changed, false);
});

test("#53 删掉「不要另开服务器」（现行 prompt 与旧段落各一份）", () => {
  const sentence =
    "Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL.";
  const source = [
    `const WEB_SURFACE_PROMPT = \`... only dsh web injects window.__DSH_BOOT__. ${sentence}\`;`,
    "const LEGACY_WEB_SURFACE = {",
    `\tsuffix: ". ... window.__DSH_BOOT__. ${sentence}"`,
    "};",
  ].join("\n");

  const once = run(53, source);
  assert.equal(once.changed, true);
  assert.ok(!once.text.includes("Do not start a replacement server"));
  assert.equal(run(53, once.text).changed, false);
});

test("#77 在现行 append(record) 上挂回退标记（clear() 带守卫的写法）", () => {
  const source = [
    "\t\t\tappend(record) {",
    "\t\t\t\tconst event = record.event;",
    '\t\t\t\tif (this.inputs.has(event.seq)) return "none";',
    "\t\t\t\tif (this.revised.size > 0) this.revised.clear();",
    "\t\t\t\tthis.inputs.set(event.seq, record);",
    "\t\t\t}",
  ].join("\n");

  const once = run(77, source, "lib/client.js");
  assert.equal(once.changed, true);
  assert.ok(once.text.includes("if (isRewindMarker(event)) {"));
  assert.ok(once.text.includes("return this.replaceWindow(entries, this.hasMore);"));
  assert.ok(once.text.includes("if (this.revised.size > 0) this.revised.clear();"), "原守卫要留着");
  assert.equal(run(77, once.text, "lib/client.js").changed, false);
});

test("#77 的老锚点（裸 clear()）仍然认得", () => {
  const source = [
    "\t\t\tappend(record) {",
    "\t\t\t\tconst event = record.event;",
    '\t\t\t\tif (this.inputs.has(event.seq)) return "none";',
    "\t\t\t\tthis.revised.clear();",
    "\t\t\t\tthis.inputs.set(event.seq, record);",
    "\t\t\t}",
  ].join("\n");
  const once = run(77, source, "lib/client.js");
  assert.equal(once.changed, true);
  assert.ok(once.text.includes("if (isRewindMarker(event)) {"));
});
