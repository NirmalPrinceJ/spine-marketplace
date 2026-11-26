import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gatewayUrl, json, projectGateway, readJson, root } from "./sources.mjs";

const [mode, path, ...extra] = process.argv.slice(2);
assert(
  extra.length === 0 && (mode === "--from" ? path : !path && [undefined, "--check"].includes(mode)),
  "Usage: npm run sync:gateway -- [--check | --from <gateway-response.json>]",
);

const response = mode === "--from" ? readJson(path) : await fetchGateway();
const snapshot = projectGateway(response);
const target = join(root, "marketplace/sources/gateway.json");
if (mode === "--check") {
  assert.deepEqual(readJson(target), snapshot, "Gateway catalog drifted. Review a refreshed snapshot.");
  console.log("Gateway snapshot matches the public catalog.");
} else {
  writeFileSync(target, json(snapshot));
  console.log(`Captured ${snapshot.counts.apps} apps, ${snapshot.counts.aiHosts} hosts and ${snapshot.counts.mcpServers} MCP servers.`);
}

async function fetchGateway() {
  const result = await fetch(gatewayUrl, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  assert(result.ok, `Gateway catalog returned HTTP ${result.status}`);
  return result.json();
}
