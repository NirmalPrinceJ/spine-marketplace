import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Ajv from "ajv/dist/2020.js";
import { buildDistribution } from "./distribution.mjs";
import { buildDomainPacks, domainPackPath } from "./domain-packs.mjs";
import {
  catalogUrl, gatewayUrl, json, projectGateway, readJson, root, uniqueBy,
} from "./sources.mjs";

const [mode, ...extra] = process.argv.slice(2);
assert(extra.length === 0 && [undefined, "--check"].includes(mode), "Usage: node scripts/catalog.mjs [--check]");
const load = (path) => readJson(join(root, "marketplace", path));
const editorial = load("sources/editorial.json");
const gateway = load("sources/gateway.json");
const contract = load("sources/public-tools.json");
assert.deepEqual(projectGateway({ marketplace: gateway }), gateway, "Gateway snapshot has non-public fields");
assert.equal(contract.name, gateway.internal.spineNetwork.id, "MCP contract and Gateway refer to different servers");
assert.match(contract.source.revision, /^[0-9a-f]{40}$/u);
uniqueBy(contract.tools, (name) => name);

const { packages: distribution, files } = buildDistribution(contract.version);
const hostIds = new Set(gateway.external.aiHosts.map((host) => host.id));
const hostDistribution = new Map(distribution.filter((pkg) => pkg.hostId).map((pkg) => [pkg.hostId, pkg]));
for (const hostId of hostDistribution.keys()) {
  assert(hostIds.has(hostId), `Distribution target has no Gateway host: ${hostId}`);
}

const connectorIds = new Set(gateway.external.apps.map((app) => app.id));
const ungrouped = new Map(gateway.external.apps.map((app) => [app.id, app]));
const [coreApps, composioApps, ...specialtyApps] = editorial.appShelves.map((group) => ({
  ...group,
  packages: group.packages.map(({ id, platformId = id, name, reads }) => {
    const app = ungrouped.get(platformId);
    if (app) {
      ungrouped.delete(platformId);
      return appPackage(app, id, reads);
    }
    assert(name && !connectorIds.has(platformId), `Missing or duplicated Gateway app: ${platformId}`);
    return {
      id, name, category: group.name, kind: "connector", source: "spine-catalog",
      routes: [], availability: "not_available_yet", liveRead: false,
      ...(reads && { reads }),
      note: "Discovery listing awaiting a Platform connection route.",
    };
  }),
}));
const hostAliases = new Map(Object.entries(editorial.hostAliases));
const mcpLegacyIds = new Map(Object.entries(editorial.mcpLegacyIds));

const external = [
  {
    id: "host", name: "Host connectors", category: "AI host", file: "ai-host",
    packages: gateway.external.aiHosts.map((host) => {
      const pkg = hostDistribution.get(host.id);
      return {
        id: hostAliases.get(host.id) ?? host.id, name: host.name, platformId: host.id,
        kind: "plugin", source: "platform-gateway", hostMarketplaceSubmitted: false,
        ...(pkg && { distribution: pkg.manifest }),
        note: "Host entry for the shared Spine Network MCP endpoint.",
      };
    }),
  },
  coreApps,
  composioApps,
  {
    id: "mcp", name: "MCP registry", file: "mcp-registry",
    packages: gateway.external.mcpServers.map(({ id, ...server }) => ({
      ...server,
      id: mcpLegacyIds.get(id) ?? id, platformId: id, kind: "mcp", source: "platform-gateway",
      note: "Third-party MCP listing awaiting tenant registration and authorization.",
    })),
  },
  ...specialtyApps,
  {
    id: "apps", name: "More Platform connectors", file: "platform-connectors",
    packages: [...ungrouped.values()].map((app) => appPackage(app)),
  },
];

const network = gateway.internal.spineNetwork;
const workbench = editorial.internalGroups.find((group) => group.id === "workbench");
const domainPacks = buildDomainPacks(load("sources/domain-packs.json"), workbench.packages, contract.tools);
const domainEntries = new Map([["skill", domainPacks.skills], ["workflow", domainPacks.workflows]]);
const internal = [
  {
    id: "host", name: "Host packages", file: "host-packages",
    packages: distribution.map((pkg) => ({
      id: pkg.id, name: pkg.name, kind: pkg.hostId ? "plugin" : "mcp",
      source: pkg.hostId ? "spine-catalog" : "platform-gateway",
      ...(!pkg.hostId && { platformId: network.id }),
      distribution: pkg.manifest, hostMarketplaceSubmitted: false,
      note: pkg.hostId
        ? "Distribution metadata for the shared Spine Network MCP endpoint."
        : "Shared MCP entry for permitted business context, Work, continuity and governed capabilities.",
    })),
  },
  ...editorial.internalGroups.filter((group) => group !== workbench).map((group) => ({
    ...group,
    packages: [...group.packages, ...(domainEntries.get(group.id) ?? [])],
  })),
  {
    id: "capability", name: "Capabilities", file: "capabilities",
    packages: contract.tools.map((name) => ({
      id: `cap-${name}`, name, kind: "capability", source: "public-mcp-contract",
      note: "Public MCP contract name. Workspace policy governs tool access and execution.",
    })),
  },
  workbench,
  gatewayGroup("accelerator", "Accelerators", "accelerators", "package", gateway.internal.accelerators,
    "Platform accelerator listing. Readiness follows its connector requirements."),
  gatewayGroup("mcp-bundle", "MCP bundles", "mcp-bundles", "package", gateway.internal.mcpTools,
    "Gateway MCP bundle for connector-backed events."),
];

const validate = new Ajv({ allErrors: true }).compile(load("schemas/package.schema.json"));
const ids = new Set();
const publishedAt = "2026-11-26";
const externalShelves = external.map((group) => generateGroup("external", group));
const internalGroups = internal.map((group) => generateGroup("internal", group));
const externalCount = externalShelves.reduce((total, group) => total + group.packages.length, 0);
const internalPackages = internalGroups.flatMap((group) =>
  group.packages.map((pkg) => ({ ...pkg, category: group.id })));
const internalById = new Map(internalPackages.map((pkg) => [pkg.id, pkg]));
const { network: networkPack, continuity } = domainPacks.index.shared;
assert.equal(internalById.get(networkPack.packageId)?.kind, "mcp", "Missing Spine Network MCP package");
assert.equal(internalById.get(continuity.packageId)?.kind, "service", "Missing IW-Continuity Bridge package");
for (const entry of [networkPack, continuity]) {
  assert.equal(internalById.get(entry.skillId)?.kind, "skill", `Missing shared skill: ${entry.skillId}`);
  assert.equal(internalById.get(entry.workflowId)?.kind, "workflow", `Missing shared workflow: ${entry.workflowId}`);
}
for (const entry of internal.flatMap((group) => group.packages)) {
  for (const id of entry.skillIds ?? []) {
    assert.equal(internalById.get(id)?.kind, "skill", `Missing skill ${id} in ${entry.id}`);
  }
  for (const id of entry.capabilityIds ?? []) {
    assert.equal(internalById.get(id)?.kind, "capability", `Missing public tool ${id} in ${entry.id}`);
  }
}
files.set(domainPackPath, json(domainPacks.index));

files.set("marketplace/external/marketplace.json", json({
  marketplace: "external", published: true, publishedAt, connected: false,
  note: "Discovery catalog. One Auth and the Platform connection registry manage account state.",
  shelves: externalShelves,
}));
files.set("marketplace/internal/marketplace.json", json({
  marketplace: "internal", published: true, publishedAt, connected: false,
  note: "Spine packages available for discovery. Runtime readiness and access are evaluated by Platform.",
  domainPacks: domainPackPath,
  groups: internalGroups.map(({ id, name, detail }) => ({ id, name, detail })),
  packages: internalPackages,
}));
files.set("marketplace/catalog.json", json({
  name: "spineworkspace-marketplace", version: "spine-marketplace-export.v1",
  published: true, publishedAt: "2026-11-25", catalog: catalogUrl,
  internal: "marketplace/internal/marketplace.json",
  external: "marketplace/external/marketplace.json",
  distribution: "distribution/index.json",
  schema: "marketplace/schemas/package.schema.json",
  domainPacks: domainPackPath,
  gateway: { url: gatewayUrl, version: gateway.version, curatedAt: gateway.curatedAt, counts: gateway.counts },
  counts: {
    external: externalCount,
    internal: internalPackages.length,
    distribution: distribution.length,
    domainPacks: domainPacks.index.packs.length,
    domainSkills: domainPacks.skills.length,
    domainWorkflows: domainPacks.workflows.length,
  },
  note: "Public discovery and distribution. Installation, connection, and authorization live in Platform.",
}));

const stale = [];
for (const [path, content] of files) {
  const target = join(root, path);
  if (mode === "--check") {
    if (!existsSync(target) || readFileSync(target, "utf8") !== content) stale.push(path);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}
for (const dir of ["marketplace/external", "marketplace/internal", "distribution"]) {
  for (const entry of readdirSync(join(root, dir), { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name).slice(root.length).replaceAll("\\", "/");
      if (!files.has(path)) stale.push(path);
    }
  }
}
assert.equal(stale.length, 0, `Missing, stale or unexpected catalog files:\n${stale.join("\n")}`);
console.log(`${mode === "--check" ? "Verified" : "Generated"} ${externalCount} external listings, ${internalPackages.length} internal listings and ${distribution.length} distribution packages.`);

function appPackage(app, id = app.id, reads) {
  return {
    ...app, id, platformId: app.id, kind: "connector", source: "platform-gateway",
    ...(reads && { reads }),
    note: app.routes.length
      ? "Connection options are listed by the Gateway. Account access follows Platform authorization."
      : "Listed by the Gateway. Connection options are pending.",
  };
}

function gatewayGroup(id, name, file, kind, rows, note) {
  return {
    id, name, file,
    packages: rows.map((row) => ({
      ...row, id: `${id}-${row.id}`, platformId: row.id, kind, source: "platform-gateway", note,
    })),
  };
}

function generateGroup(market, group) {
  const detail = `marketplace/${market}/${group.file}.json`;
  assert(!files.has(detail), `Duplicate detail file: ${detail}`);
  const category = group.category ?? group.name;
  const packages = group.packages.map((pkg) => {
    const entry = {
      source: "spine-catalog", category, ...pkg, market,
      ...(market === "external" && { shelf: group.id }),
      published: true, connected: false,
    };
    assert(validate(entry), `Invalid package ${entry.id}: ${JSON.stringify(validate.errors)}`);
    for (const id of [entry.id, ...(entry.aliases ?? [])]) {
      assert(!ids.has(id), `Duplicate catalog ID or alias: ${id}`);
      ids.add(id);
    }
    if (entry.domainSlug) assert.equal(entry.id, `wb-${entry.domainSlug}`);
    if (entry.distribution) assert(files.has(entry.distribution), `Missing distribution: ${entry.distribution}`);
    for (const id of [entry.linkedConnector, ...(entry.requiredConnectorIds ?? [])].filter(Boolean)) {
      assert(connectorIds.has(id), `Unknown Gateway connector ${id} in ${entry.id}`);
    }
    return entry;
  });
  files.set(detail, json({ marketplace: market, category, published: true, packages }));
  return { id: group.id, name: group.name, detail, packages: packages.map(compact) };
}

function compact(pkg) {
  const keys = [
    "id", "name", "kind", "published", "connected", "source", "platformId", "aliases", "domainSlug",
    "domainId", "surfaceSlug", "delivery",
    "routes", "availability", "liveRead", "hostMarketplaceSubmitted", "distribution",
  ];
  return Object.fromEntries(keys.filter((key) => key in pkg).map((key) => [key, pkg[key]]));
}
