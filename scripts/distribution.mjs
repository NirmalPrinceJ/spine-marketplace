import { catalogUrl, json, mcpEndpoint } from "./sources.mjs";

const packageVersion = "0.1.0";
const transport = "streamable-http";
const description = "Connect to governed business context and continuity through Spine Network MCP.";
const profiles = [
  { target: "chatgpt", surface: "ChatGPT", hostId: "chatgpt", setup: "manual" },
  { target: "claude", surface: "Claude Code", hostId: "claude", setup: "config" },
  { target: "cursor", surface: "Cursor", hostId: "cursor", setup: "config" },
  { target: "gemini", surface: "Gemini CLI", hostId: "gemini", setup: "config" },
  { target: "grok", surface: "Grok and Grok Build", hostId: "grok", setup: "manual-and-config" },
  { target: "vscode", surface: "VS Code with GitHub Copilot", hostId: "github-copilot", setup: "config" },
  { target: "microsoft-365-copilot", surface: "Microsoft 365 Copilot via Copilot Studio", hostId: "microsoft-365-copilot", setup: "manual" },
  { target: "windsurf", surface: "Windsurf", hostId: "windsurf", setup: "config" },
  { target: "perplexity", surface: "Perplexity", hostId: "perplexity", setup: "manual" },
  { target: "generic-mcp", surface: "MCP clients and registry", hostId: null, setup: "reference" },
];

export function buildDistribution(contractVersion) {
  const configFiles = {
    claude: {
      ".claude-plugin/plugin.json": json({
        name: "spine-network",
        version: packageVersion,
        description,
        homepage: "https://spineworkspace.com",
        repository: catalogUrl,
      }),
      ".mcp.json": json({ mcpServers: { spine: { type: "http", url: mcpEndpoint } } }),
    },
    cursor: {
      "mcp.json": json({ mcpServers: { spine: { url: mcpEndpoint } } }),
    },
    gemini: {
      "settings.json": json({ mcpServers: { spine: { httpUrl: mcpEndpoint } } }),
    },
    grok: {
      "config.toml": `[mcp_servers.spine]\nurl = "${mcpEndpoint}"\n`,
    },
    vscode: {
      "mcp.json": json({ servers: { spine: { type: "http", url: mcpEndpoint } } }),
    },
    windsurf: {
      "mcp_config.json": json({ mcpServers: { spine: { serverUrl: mcpEndpoint } } }),
    },
    "generic-mcp": {
      "server.json": json({
        $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        name: "com.spineworkspace/spine-network",
        title: "Spine Network MCP",
        description,
        version: contractVersion,
        repository: { url: catalogUrl, source: "github" },
        remotes: [{ type: transport, url: mcpEndpoint }],
      }),
    },
  };
  const files = new Map();
  const packages = profiles.map(({ target, surface, hostId, setup }) => {
    const dir = `distribution/${target}`;
    const id = `spine-network-${hostId ? target : "mcp"}`;
    const manifest = `${dir}/package.json`;
    const config = Object.entries(configFiles[target] ?? {});
    const artifacts = config.map(([path, content]) => {
      const fullPath = `${dir}/${path}`;
      files.set(fullPath, content);
      return fullPath;
    });
    files.set(manifest, json({
      name: id,
      version: packageVersion,
      private: true,
      spine: {
        endpoint: mcpEndpoint,
        transport,
        authorization: "oauth",
        published: true,
        catalog: catalogUrl,
        hostMarketplaceSubmitted: false,
        connected: false,
        hostVerification: "unverified",
        surface,
        setup,
      },
    }));
    return { id, name: hostId ? `Spine Network for ${surface}` : "Spine Network MCP", hostId, surface, setup, manifest, artifacts };
  });
  files.set("distribution/index.json", json({
    endpoint: mcpEndpoint,
    transport,
    authorization: "oauth",
    packages,
  }));
  return { files, packages };
}
