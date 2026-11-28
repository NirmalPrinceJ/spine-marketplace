import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  mcpEndpoint, projectGateway, projectToolContract, readJson, root,
} from "./sources.mjs";

const read = (path) => readJson(join(root, path));
const gateway = read("marketplace/sources/gateway.json");

test("Gateway capture keeps only approved discovery fields", () => {
  const marketplace = structuredClone(gateway);
  const [app] = marketplace.external.apps;
  app.connected = true;
  app.accountId = "test-account";
  app.authConfig = { clientSecret: "test-secret" };
  marketplace.internal.accelerators[0].autoActivates = ["test-operation"];
  marketplace.internal.spineNetwork.credentialId = "test-credential";
  const projected = projectGateway({ marketplace, connectors: [app] });
  assert.deepEqual(projected, gateway);
});

test("Gateway capture rejects contract and connection route drift", () => {
  assert.throws(() => projectGateway({ marketplace: { version: "spine-marketplace.v2" } }),
    /Unrecognized Gateway marketplace contract/);
  const marketplace = structuredClone(gateway);
  marketplace.external.apps[0].routes = ["unexpected-route"];
  assert.throws(() => projectGateway({ marketplace }), /Unknown Platform connector route/);
  marketplace.external.apps[0].routes = [];
  assert.throws(() => projectGateway({ marketplace }), /route and availability disagree/);
});

test("MCP capture records tool names and rejects duplicate names", () => {
  const snapshot = read("marketplace/sources/public-tools.json");
  const manifest = {
    name: snapshot.name,
    version: snapshot.version,
    transport: { type: "streamable-http", url: mcpEndpoint },
    authentication: { type: "oauth" },
    tools: snapshot.tools.map((name) => ({ name, inputSchema: { type: "object" } })),
  };
  assert.deepEqual(projectToolContract(manifest, snapshot.source.revision), snapshot);
  const listed = read("marketplace/internal/capabilities.json").packages.map((pkg) => pkg.name);
  assert.deepEqual(listed, snapshot.tools);
  manifest.tools.push(manifest.tools[0]);
  assert.throws(() => projectToolContract(manifest, snapshot.source.revision), /Duplicate catalog/);
});

test("every Gateway entry appears once and editorial entries have no route or live read", () => {
  const { shelves } = read("marketplace/external/marketplace.json");
  const all = shelves.flatMap((shelf) => shelf.packages);
  const platformIds = (kind) => all.filter((pkg) => pkg.kind === kind && pkg.source === "platform-gateway")
    .map(({ platformId }) => platformId).sort();
  for (const [kind, platform] of [
    ["connector", gateway.external.apps],
    ["plugin", gateway.external.aiHosts],
    ["mcp", gateway.external.mcpServers],
  ]) {
    assert.deepEqual(platformIds(kind), platform.map(({ id }) => id).sort());
  }
  assert.deepEqual(
    all.filter((pkg) => pkg.liveRead).map(({ platformId }) => platformId).sort(),
    gateway.external.apps.filter((app) => app.liveRead).map(({ id }) => id).sort(),
  );
  for (const pkg of all.filter((pkg) => pkg.source === "spine-catalog")) {
    assert.deepEqual([pkg.routes, pkg.availability, pkg.liveRead], [[], "not_available_yet", false], pkg.id);
  }
});

test("host listings resolve to packages and configurations for the same MCP endpoint", () => {
  const hosts = read("marketplace/external/ai-host.json").packages;
  const dist = read("distribution/index.json");
  const byHostId = new Map(dist.packages.map((pkg) => [pkg.hostId, pkg]));
  for (const [hostId, pkg] of byHostId) {
    if (!hostId) continue;
    const { distribution } = hosts.find((host) => host.platformId === hostId);
    assert.equal(distribution, pkg.manifest);
    const { spine } = read(distribution);
    assert.deepEqual([spine.endpoint, spine.hostMarketplaceSubmitted, spine.hostVerification],
      [mcpEndpoint, false, "unverified"]);
  }
  assert.deepEqual(read("distribution/claude/.mcp.json").mcpServers.spine, { type: "http", url: mcpEndpoint });
  assert.deepEqual(read("distribution/vscode/mcp.json").servers.spine, { type: "http", url: mcpEndpoint });
  assert.equal(read("distribution/gemini/settings.json").mcpServers.spine.httpUrl, mcpEndpoint);
  assert.equal(read("distribution/windsurf/mcp_config.json").mcpServers.spine.serverUrl, mcpEndpoint);
  assert.equal(readFileSync(join(root, "distribution/grok/config.toml"), "utf8"),
    `[mcp_servers.spine]\nurl = "${mcpEndpoint}"\n`);
  assert.deepEqual(read("distribution/generic-mcp/server.json").remotes, [{ type: "streamable-http", url: mcpEndpoint }]);
});

test("Workbench packages use the routed domains and keep legacy names resolvable", () => {
  const packs = read("marketplace/internal/workbench.json").packages;
  const aliases = new Map(packs.flatMap((pkg) => (pkg.aliases ?? []).map((alias) => [alias, pkg.domainSlug])));
  assert.equal(aliases.get("wb-people"), "humanresources");
  assert.equal(aliases.get("wb-revenue-operations"), "revops");
  assert.equal(aliases.get("wb-customer-support"), "service");
  assert.equal(aliases.get("wb-customer-success"), "account-success");
  for (const pkg of packs) assert.equal(pkg.id, `wb-${pkg.domainSlug}`);
});

test("catalog.json carries verified SHA-256 provenance checksums and runtime compatibility", () => {
  const catalog = read("marketplace/catalog.json");
  assert.equal(catalog.compatibility?.runtimeContract, "2026-11-28.platform-runtime.v1");
  assert.equal(catalog.provenance?.algorithm, "sha256");
  assert.match(catalog.provenance?.catalogChecksum ?? "", /^sha256:[0-9a-f]{64}$/);
  const digest = (rel) =>
    `sha256:${createHash("sha256").update(readFileSync(join(root, rel), "utf8")).digest("hex")}`;
  assert.equal(catalog.provenance.artifacts.external, digest(catalog.external));
  assert.equal(catalog.provenance.artifacts.internal, digest(catalog.internal));
  assert.equal(catalog.provenance.artifacts.distribution, digest(catalog.distribution));
  assert.equal(catalog.provenance.artifacts.domainPacks, digest(catalog.domainPacks));
  assert.equal(catalog.provenance.artifacts.schema, digest(catalog.schema));
});
