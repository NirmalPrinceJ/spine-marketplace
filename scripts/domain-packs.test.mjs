import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { buildDomainPacks, domainPackPath } from "./domain-packs.mjs";
import { readJson, root } from "./sources.mjs";

const read = (path) => readJson(join(root, "marketplace", path));
const source = read("sources/domain-packs.json");
const toolNames = read("sources/public-tools.json").tools;
const workbenches = read("internal/workbench.json").packages;
const catalog = read("catalog.json");
const domainIndex = read("internal/domain-packs.json");
const internal = new Map(read("internal/marketplace.json").packages.map((pkg) => [pkg.id, pkg]));
const skills = new Map(read("internal/skills.json").packages.map((pkg) => [pkg.id, pkg]));
const workflows = new Map(read("internal/workflows.json").packages.map((pkg) => [pkg.id, pkg]));

test("covers all thirteen Platform domain apps with discoverable skills and workflows", () => {
  assert.equal(catalog.domainPacks, domainPackPath);
  assert.deepEqual(domainIndex.packs.map(({ id }) => id), [
    "executive", "sales", "revenue-operations", "customer-success", "customer-support",
    "marketing", "finance", "operations", "product", "engineering", "people", "legal",
    "platform-administration",
  ]);
  for (const pack of domainIndex.packs) {
    assert(pack.skillIds.length >= 2 && pack.workflowIds.length >= 2, pack.id);
    for (const id of pack.skillIds) {
      const skill = skills.get(id);
      assert.equal(internal.get(id).domainId, pack.id);
      assert.equal(skill.domainId, pack.id);
      assert.equal(skill.delivery, "catalog-template");
      assert(skill.capabilityIds.every((ref) => internal.get(ref)?.kind === "capability"));
    }
    for (const id of pack.workflowIds) {
      const workflow = workflows.get(id);
      assert.equal(internal.get(id).domainId, pack.id);
      assert.equal(workflow.domainId, pack.id);
      assert(workflow.skillIds.every((ref) => pack.skillIds.includes(ref)));
      assert(workflow.approval.reviewer && workflow.approval.requiredFor && workflow.verification);
    }
  }
  assert.equal(catalog.counts.domainSkills, domainIndex.packs.flatMap((pack) => pack.skillIds).length);
  assert.equal(catalog.counts.domainWorkflows, domainIndex.packs.flatMap((pack) => pack.workflowIds).length);
});

test("distinguishes Technical Account Success skills and workflows within Customer Success", () => {
  const customerSuccess = domainIndex.packs.find((pack) => pack.id === "customer-success");
  assert.equal(customerSuccess.workbenchId, "wb-account-success");
  assert(customerSuccess.projectionSlugs.includes("technical-account-success"));
  assert(customerSuccess.workflowIds.some((id) => workflows.get(id).surfaceSlug === undefined));
  assert.equal(customerSuccess.workflowIds.filter((id) => workflows.get(id).surfaceSlug === "technical-account-success").length, 2);
  assert.equal(customerSuccess.skillIds.filter((id) => skills.get(id).surfaceSlug === "technical-account-success").length, 3);
});

test("shared Spine Network MCP and IW-Continuity entries resolve to reusable skills and workflows", () => {
  const { network, continuity } = domainIndex.shared;
  assert.equal(internal.get(network.packageId).name, "Spine Network MCP");
  assert.equal(internal.get(network.packageId).kind, "mcp");
  assert.equal(internal.get(continuity.packageId).name, "IW-Continuity Bridge");
  assert.equal(internal.get(continuity.packageId).kind, "service");
  for (const entry of [network, continuity]) {
    assert(skills.has(entry.skillId));
    assert(workflows.get(entry.workflowId).skillIds.includes(entry.skillId));
  }
});

test("rejects missing domain coverage, unknown MCP tools and cross-projection skill links", () => {
  const incomplete = structuredClone(source);
  incomplete.domains.shift();
  assert.throws(() => buildDomainPacks(incomplete, workbenches, toolNames), /cover every Workbench package/);

  const unknown = structuredClone(source);
  unknown.domains[0].skills[0].tools.push("unpublished_tool");
  assert.throws(() => buildDomainPacks(unknown, workbenches, toolNames), /Unknown public MCP tool/);

  const wrongProjection = structuredClone(source);
  const customerSuccess = wrongProjection.domains.find((domain) => domain.id === "customer-success");
  customerSuccess.workflows.find(({ id }) => id === "renewal-review").skills.push("integration-diagnostics");
  assert.throws(() => buildDomainPacks(wrongProjection, workbenches, toolNames), /scoped to a different projection/);
});
