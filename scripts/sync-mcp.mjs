import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { contractPath, json, projectToolContract, root } from "./sources.mjs";

const [checkout, requestedRef = "HEAD", ...extra] = process.argv.slice(2);
assert(checkout && extra.length === 0, "Usage: npm run sync:mcp -- <platform-checkout> [git-ref]");
const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8" });
const revision = git("rev-parse", "--verify", "--end-of-options", `${requestedRef}^{commit}`).trim();
const manifest = JSON.parse(git("show", `${revision}:${contractPath}`));
const snapshot = projectToolContract(manifest, revision);
writeFileSync(join(root, "marketplace/sources/public-tools.json"), json(snapshot));
console.log(`Captured ${snapshot.tools.length} public MCP tool names at ${revision.slice(0, 12)}.`);
