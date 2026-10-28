/**
 * Apply dsh-purge patches to a SCRATCH copy of a host tree and report status.
 * Never points at a real installation: the caller passes the scratch aiBase.
 *
 * Usage: node tools/apply-scratch.mjs <aiBase> [surface]
 */
import fs from "node:fs";
import path from "node:path";
import * as core from "../lib/core.js";

const aiBase = process.argv[2];
if (!aiBase || !fs.existsSync(aiBase)) {
  console.error("usage: node tools/apply-scratch.mjs <aiBase>");
  process.exit(2);
}

const report = await core.applyPatches(aiBase, core.ALL_PATCHES, { forApply: true });
const bad = [];
for (const row of report) {
  if (row.status === "applied" || row.status === "already" || row.status === "na") continue;
  bad.push(row);
}
const count = (s) => report.filter((r) => r.status === s).length;
console.log(`aiBase ${aiBase}`);
console.log(
  `applied=${count("applied")} already=${count("already")} na=${count("na")} ` +
    `skipped=${count("skipped")} missing_file=${count("missing_file")} ` +
    `pattern_not_found=${count("pattern_not_found")} failed=${count("failed")} read_error=${count("read_error")}`,
);
console.log("");
for (const row of bad) {
  console.log(`${row.status.padEnd(18)} #${String(row.patch_id).padEnd(3)} ${row.name}`);
}
const outPath = path.join("tools", "out", `apply-${path.basename(aiBase)}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nreport -> ${outPath}`);
