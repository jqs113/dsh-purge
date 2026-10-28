/**
 * Read-only diagnostic: for every dsh-purge patch, report whether its anchor
 * patterns still match the host source in DSH_BASE, and whether its markers are
 * already present.
 *
 * Usage:
 *   node tools/patch-compat-report.mjs            (uses DSH_BASE)
 */
import fs from "node:fs";
import path from "node:path";
import * as core from "../lib/core.js";

const aiBase = String(process.env.DSH_BASE || "").trim();
if (!aiBase) {
  console.error("set DSH_BASE to the @deepseek-ai package root");
  process.exit(2);
}

const asLf = (t) => (typeof t === "string" ? t.replace(/\r\n/g, "\n") : t);

function cloneRegExp(pattern, global) {
  let flags = String(pattern.flags || "").replace("g", "");
  if (global) flags += "g";
  return new RegExp(pattern.source, flags);
}

function matchesPattern(hay, pattern) {
  if (pattern instanceof RegExp) return cloneRegExp(pattern, false).test(hay);
  return hay.includes(asLf(pattern));
}

function patchReplacements(p) {
  if (Array.isArray(p.replacements)) return p.replacements;
  return (p.patterns ?? []).map((pat) => ({ pattern: pat, replace: p.replace }));
}

function keysOf(p) {
  return Array.isArray(p.file) ? p.file : [p.file];
}

function pathsOf(files, key) {
  const val = files?.[key];
  if (!val) return [];
  return (Array.isArray(val) ? val : [val]).filter(Boolean);
}

function markerPresent(text, patch) {
  const hay = asLf(text);
  if (Array.isArray(patch.markers) && patch.markers.length) {
    const test = (m) => hay.includes(asLf(m));
    return patch.markersAny ? patch.markers.some(test) : patch.markers.every(test);
  }
  if (patch.marker) return hay.includes(asLf(patch.marker));
  return false;
}

const files = core.targetFiles(aiBase);
const rows = [];
let matchedAny = 0;
let unmatched = 0;
let noFile = 0;

for (const patch of core.ALL_PATCHES) {
  const keys = keysOf(patch);
  const targets = [];
  for (const key of keys) {
    const list = pathsOf(files, key);
    if (!list.length) targets.push({ key, fp: "", missing: true });
    else for (const fp of list) targets.push({ key, fp, missing: false });
  }
  const present = targets.filter((t) => !t.missing);
  if (!present.length) {
    noFile += 1;
    rows.push({
      id: patch.id,
      name: patch.name,
      state: "NO_TARGET_FILE",
      detail: keys.join(","),
      hits: [],
    });
    continue;
  }
  const hitFiles = [];
  const missFiles = [];
  const markedFiles = [];
  for (const t of targets) {
    if (t.missing) continue;
    const text = fs.readFileSync(t.fp, "utf8");
    const reps = patchReplacements(patch).filter((r) => r && r.pattern && typeof r.replace === "string");
    const hit = reps.findIndex((r) => matchesPattern(asLf(text), r.pattern));
    const marked = markerPresent(text, patch);
    if (hit >= 0) hitFiles.push(`${t.key}#${hit}`);
    else missFiles.push(t.key);
    if (marked) markedFiles.push(t.key);
  }
  let state;
  if (hitFiles.length) {
    matchedAny += 1;
    state = "ANCHOR_OK";
  } else if (markedFiles.length) {
    matchedAny += 1;
    state = "MARKER_ONLY";
  } else {
    unmatched += 1;
    state = "ANCHOR_LOST";
  }
  rows.push({
    id: patch.id,
    name: patch.name,
    state,
    detail: `hit=[${hitFiles.join(" ")}] miss=[${missFiles.join(" ")}] marked=[${markedFiles.join(" ")}]`,
    hits: hitFiles,
  });
}

const outDir = path.resolve("tools", "out");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "patch-compat.json"), JSON.stringify({ aiBase, rows }, null, 2));

const lost = rows.filter((r) => r.state === "ANCHOR_LOST");
const nofile = rows.filter((r) => r.state === "NO_TARGET_FILE");
console.log(`aiBase        ${aiBase}`);
console.log(`patches       ${rows.length}`);
console.log(`anchor ok     ${rows.filter((r) => r.state === "ANCHOR_OK").length}`);
console.log(`marker only   ${rows.filter((r) => r.state === "MARKER_ONLY").length}`);
console.log(`anchor lost   ${lost.length}`);
console.log(`no target     ${nofile.length}`);
console.log("");
for (const r of lost) console.log(`LOST #${r.id} ${r.name}  ${r.detail}`);
if (nofile.length) {
  console.log("");
  for (const r of nofile) console.log(`NOFILE #${r.id} ${r.name}  ${r.detail}`);
}
