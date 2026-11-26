import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const gatewayUrl = "https://gateway.spineworkspace.com/api/v1/connectors/catalog";
export const mcpEndpoint = "https://mcp.spineworkspace.com/mcp";
export const catalogUrl = "https://github.com/NirmalPrinceJ/spine-marketplace";
export const contractPath = "services/mcp-connector/server.json";
export const marketplaceVersion = "spine-marketplace.v1";

const catalogRoutes = new Set(["spine-connector", "composio-managed", "composio-user-key"]);
const idPattern = /^[a-z0-9][a-z0-9_-]*$/u;

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function json(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

export function uniqueBy(rows, key) {
  const values = new Set(rows.map(key));
  assert.equal(values.size, rows.length, "Duplicate catalog identifiers or values");
}

function text(value, field, { empty = false } = {}) {
  assert(typeof value === "string" && (empty || value.trim()), `Invalid ${field}`);
  return value;
}

function labels(values, field) {
  assert(Array.isArray(values), `Invalid ${field}`);
  return values.map((value) => text(value, field));
}

function id(value) {
  assert.equal(typeof value, "string", "Invalid identifier");
  assert.match(value, idPattern, "Invalid identifier");
  return value;
}

function identity(record) {
  return { id: id(record.id), name: text(record.name, "name") };
}

function projectApp(app) {
  const routes = labels(app.routes, "routes");
  assert(routes.every((route) => catalogRoutes.has(route)), "Unknown Platform connector route");
  uniqueBy(routes, (value) => value);
  const availability = routes.length ? "available" : "not_available_yet";
  assert.equal(app.availability, availability, "Platform route and availability disagree");
  assert.equal(typeof app.liveRead, "boolean", "Invalid Platform liveRead flag");
  return {
    ...identity(app),
    category: text(app.category, "category"),
    departments: labels(app.departments, "departments"),
    domains: labels(app.domains, "domains"),
    routes,
    availability,
    liveRead: app.liveRead,
    vetting: text(app.vetting, "vetting"),
  };
}

export function projectGateway({ marketplace }) {
  assert.equal(marketplace?.version, marketplaceVersion, "Unrecognized Gateway marketplace contract");
  const { external, internal } = marketplace;
  const categories = labels(external.categories, "categories");
  const apps = external.apps.map(projectApp);
  const aiHosts = external.aiHosts.map((host) => {
    assert.equal(host.connectsThrough, "spine-network-mcp");
    return { ...identity(host), connectsThrough: "spine-network-mcp" };
  });
  const mcpServers = external.mcpServers.map((server) => {
    assert.equal(server.registration, "not_registered");
    return {
      ...identity(server),
      linkedConnector: server.linkedConnector === null ? null : id(server.linkedConnector),
      vetting: text(server.vetting, "vetting"),
      registration: "not_registered",
    };
  });
  const network = internal.spineNetwork;
  assert.equal(network.endpoint, mcpEndpoint, "Unexpected Spine Network MCP endpoint");
  assert.equal(network.authorization, "oauth", "Unexpected Spine Network MCP authorization");
  const spineNetwork = { ...identity(network), endpoint: mcpEndpoint, authorization: "oauth" };
  const accelerators = internal.accelerators.map((item) => ({
    ...identity(item),
    requiredConnectorIds: item.requiredConnectorIds.map(id),
  }));
  const mcpTools = internal.mcpTools.map((item) => ({
    ...identity(item),
    description: text(item.description ?? "", "MCP bundle description", { empty: true }),
    requiredConnectorIds: item.requiredConnectorIds.map(id),
  }));
  for (const rows of [apps, aiHosts, mcpServers, accelerators, mcpTools]) {
    uniqueBy(rows, (row) => row.id);
  }
  const counts = {
    apps: apps.length,
    available: apps.filter((app) => app.availability === "available").length,
    aiHosts: aiHosts.length,
    mcpServers: mcpServers.length,
    accelerators: accelerators.length,
    mcpTools: mcpTools.length,
  };
  for (const [key, count] of Object.entries(counts)) {
    assert.equal(marketplace.counts[key], count, `Gateway count mismatch for ${key}`);
  }
  const curatedAt = text(marketplace.curatedAt, "curatedAt");
  assert.match(curatedAt, /^\d{4}-\d{2}-\d{2}$/u);
  return {
    version: marketplaceVersion,
    curatedAt,
    external: { categories, apps, aiHosts, mcpServers },
    internal: { spineNetwork, accelerators, mcpTools },
    counts,
  };
}

export function projectToolContract(manifest, revision) {
  assert.match(revision, /^[0-9a-f]{40}$/u, "Expected a full Platform commit SHA");
  assert.equal(manifest.name, "iw-spine-network", "Unexpected MCP contract name");
  assert.equal(manifest.transport?.type, "streamable-http");
  assert.equal(manifest.transport?.url, mcpEndpoint);
  assert.equal(manifest.authentication?.type, "oauth");
  const tools = manifest.tools.map((tool) => {
    const name = id(tool.name);
    assert.match(name, /^[a-z][a-z0-9_]*$/u, "Unexpected public MCP tool name");
    return name;
  });
  assert(tools.length > 0, "The public MCP contract must declare tools");
  uniqueBy(tools, (tool) => tool);
  const version = text(manifest.version, "MCP version");
  assert.match(version, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u);
  return { source: { revision, path: contractPath }, name: manifest.name, version, tools };
}
