# SpineWorkspace Marketplace

Public discovery catalog and distribution packages for Spine Workspace. Start with [the catalog index](marketplace/catalog.json) or [the host distribution index](distribution/index.json).

| Catalog | Contents | Index |
|---|---|---|
| External | Platform apps, AI hosts, third-party MCP servers, and additional discovery listings | [External marketplace](marketplace/external/marketplace.json) |
| Internal | Spine services, Twin, agents, skills, workflows, knowledge packs, MCP tool listings, Workbench packs, accelerators, MCP bundles, and distribution packages | [Internal marketplace](marketplace/internal/marketplace.json) |
| Distribution | AI host setup and a generic MCP Registry descriptor for the shared Spine Network MCP endpoint | [Distribution index](distribution/index.json) |

The Platform Gateway supplies the public app, AI host, third-party MCP, accelerator, and bundle inventories. The repository maintains editorial shelves and adds discovery entries for Spine packages. One Auth and the Platform connection registry own identity, installation, authorization, and account state. [Public Gateway catalog](https://gateway.spineworkspace.com/api/v1/connectors/catalog)

### Reading a listing

- `id` is the public catalog ID. When present, `platformId` identifies the corresponding Gateway entry. `aliases` records previous catalog IDs. A Workbench package uses `wb-<domainSlug>` and carries its canonical routing slug.
- `routes` lists the Gateway's connection options. `liveRead` mirrors the Gateway's read-path flag.
- `published: true` denotes discovery in the Spine catalog. The legacy `connected: false` field is constant export metadata. Signed-in Platform responses supply actual connection state.
- `hostMarketplaceSubmitted: false` and `hostVerification: "unverified"` describe the distribution records in this repository. Host approval, installation, and OAuth consent have separate lifecycles.
- Capability listings mirror public MCP tool names. Effective tool access depends on the signed-in user, workspace, and Platform policy.

## Domain skills and workflows

The domain packs cover the 13 Platform domain apps. The Customer Success pack has dedicated Technical Account Success entries alongside Account Success. Filter the catalog by `domainId` and, for a scoped entry, `surfaceSlug`. [Domain packs](marketplace/internal/domain-packs.json)

- Skills declare required context, public MCP capability references, and the artifact they prepare. [Skills](marketplace/internal/skills.json)
- Workflows declare an ordered list of skills, a trigger, the authorized human approval point, an output, and the evidence needed to verify the result. [Workflows](marketplace/internal/workflows.json)
- Spine Network MCP opens permitted Work and capabilities on supported hosts. IW-Continuity Bridge carries scoped context and commitments so an authorized participant can resume the same Work ID. Both have reusable skills and workflows in the domain pack index.

These are catalog templates. The Platform owns activation, permissions, approvals and outcome verification.

Edit domain definitions in [the domain pack source](marketplace/sources/domain-packs.json). The domain list follows the [Platform domain app registry](https://github.com/SpineInnovTech/spineworkspace-live/blob/f9cd42b622a6b75c3e6a73a72c94dbff0c18e7ce/packages/workbench-config/src/domain-apps.ts).

## Set up Spine Network MCP

Use `https://mcp.spineworkspace.com/mcp` with Streamable HTTP and OAuth. Add the server using your host's setup below and sign in through One Auth when prompted. Merge configuration examples into the existing file for the selected host.

| Client | Setup | Package or instructions |
|---|---|---|
| ChatGPT | Add a custom MCP server and enter the Spine Network endpoint. | [Package](distribution/chatgpt/package.json) · [OpenAI docs](https://developers.openai.com/api/docs/guides/custom-mcp-server) |
| Claude Code | Load the local plugin with `claude --plugin-dir ./distribution/claude` from the repository root. Open `/mcp` to authorize it. | [Plugin](distribution/claude/) · [Claude Code docs](https://code.claude.com/docs/en/mcp) |
| Cursor | Merge the `mcpServers.spine` entry into `.cursor/mcp.json` and authorize the server in MCP settings. | [Config](distribution/cursor/mcp.json) · [Cursor docs](https://cursor.com/docs/mcp) |
| Gemini CLI | Merge the entry into `.gemini/settings.json` and run `/mcp auth spine` if the CLI prompts for OAuth. | [Config](distribution/gemini/settings.json) · [Gemini CLI docs](https://geminicli.com/docs/tools/mcp-server/) |
| Grok | Add a custom connector in Grok. In Grok Build, merge the TOML entry into `.grok/config.toml` or run `grok mcp add --transport http spine https://mcp.spineworkspace.com/mcp`. | [Config](distribution/grok/config.toml) · [Grok docs](https://docs.x.ai/grok/connectors) · [Grok Build docs](https://docs.x.ai/developers/docs-mcp) |
| VS Code with GitHub Copilot | Merge the `servers.spine` entry into `.vscode/mcp.json` and start the server from VS Code's MCP controls. | [Config](distribution/vscode/mcp.json) · [VS Code docs](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Microsoft 365 Copilot | In Copilot Studio, add an MCP tool to a custom agent. Use OAuth 2.0 with dynamic discovery where tenant policy permits it. | [Package](distribution/microsoft-365-copilot/package.json) · [Microsoft docs](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent) |
| Windsurf | Merge the entry into `~/.codeium/windsurf/mcp_config.json` and refresh MCP servers in Cascade. | [Config](distribution/windsurf/mcp_config.json) |
| Perplexity | In Connectors, add a custom remote connector, enter the endpoint, and choose OAuth. | [Package](distribution/perplexity/package.json) · [Perplexity docs](https://www.perplexity.ai/help-center/en/articles/11502712-local-and-remote-mcps-for-perplexity) |
| Generic MCP client or registry | For a compatible client, select Streamable HTTP and enter the endpoint. The descriptor supplies remote server metadata for a future registry submission. | [Server descriptor](distribution/generic-mcp/server.json) · [MCP Registry docs](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx) |

## Refresh and verify the catalog

Use Node.js 22 or later. Commit source and generated changes together so consumers can use the JSON directly.

```bash
npm ci --ignore-scripts
npm run sync:gateway
npm run sync:mcp -- ../spineworkspace-live main
npm run generate
npm test
```

- `sync:gateway` reads the signed-out public Gateway response and keeps the discovery fields in [the Gateway snapshot](marketplace/sources/gateway.json). Run `npm run sync:gateway -- --check` to compare the live response with the committed snapshot. Use `--from <gateway-response.json>` to refresh from a captured response.
- `sync:mcp` reads tool names from `services/mcp-connector/server.json` at a specified Platform commit and records the revision in [the tool snapshot](marketplace/sources/public-tools.json).
- Edit the public descriptions, shelf assignments, and Workbench mappings in [the editorial source](marketplace/sources/editorial.json). Workbench route IDs follow [the Platform domain catalog](https://github.com/SpineInnovTech/spineworkspace-live/blob/f9cd42b622a6b75c3e6a73a72c94dbff0c18e7ce/packages/workbench-config/src/domain-catalog.ts).
- `npm test` verifies the source projections, domain coverage, skill and workflow references, routing, host artifacts, and generated files offline. Package details use [the JSON Schema](marketplace/schemas/package.schema.json).
