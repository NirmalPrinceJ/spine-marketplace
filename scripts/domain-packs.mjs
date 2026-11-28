import assert from "node:assert/strict";
import { uniqueBy } from "./sources.mjs";

const platformDomain = "platform-administration";
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const domainPackPath = "marketplace/internal/domain-packs.json";
const sharedDomainDependencies = {
  network: {
    packageId: "spine-network-mcp",
    skillId: "skill-spine-network-discovery",
    workflowId: "workflow-spine-network-context",
  },
  continuity: {
    packageId: "iw-continuity-bridge",
    skillId: "skill-continuity-handoff",
    workflowId: "workflow-handoff",
  },
};

export function buildDomainPacks({ source, domains }, workbenches, publicTools) {
  assert.match(source.revision, /^[0-9a-f]{40}$/u);
  assert.equal(source.path, "packages/workbench-config/src/domain-apps.ts");
  uniqueBy(domains, (domain) => domain.id);
  const workbenchById = new Map(workbenches.map((pkg) => [pkg.id, pkg]));
  const toolNames = new Set(publicTools);
  const workbenchIds = [];
  const skills = [];
  const workflows = [];
  const packs = domains.map((domain) => {
    assert.match(domain.id, idPattern);
    assert(typeof domain.name === "string" && domain.name.trim(), `Missing domain name: ${domain.id}`);
    uniqueBy(domain.projectionSlugs, (slug) => slug);
    for (const slug of domain.projectionSlugs) assert.match(slug, idPattern);
    if (domain.id === platformDomain) {
      assert.equal(domain.workbenchId, null, "Platform & Administration uses the shared Platform surface");
      assert.deepEqual(domain.projectionSlugs, [], "Platform & Administration has no Work projection");
    } else {
      const workbench = workbenchById.get(domain.workbenchId);
      assert(workbench, `Unknown Workbench package: ${domain.workbenchId}`);
      assert(domain.projectionSlugs.includes(workbench.domainSlug), `Missing projection for ${workbench.id}`);
      workbenchIds.push(workbench.id);
    }
    assert(domain.skills.length && domain.workflows.length, `Incomplete domain: ${domain.id}`);
    uniqueBy(domain.skills, (skill) => skill.id);
    uniqueBy(domain.workflows, (workflow) => workflow.id);
    const skillById = new Map(domain.skills.map((skill) => [skill.id, skill]));
    const domainSkills = domain.skills.map((skill) => {
      assert.match(skill.id, idPattern);
      const capabilityIds = skill.tools.map((name) => {
        assert(toolNames.has(name), `Unknown public MCP tool ${name} in ${domain.id}/${skill.id}`);
        return `cap-${name}`;
      });
      return {
        ...scopedFields(domain, skill, "skill"),
        reads: skill.reads,
        capabilityIds,
        output: skill.output,
      };
    });
    const domainWorkflows = domain.workflows.map((workflow) => {
      assert.match(workflow.id, idPattern);
      const skillIds = workflow.skills.map((key) => {
        const skill = skillById.get(key);
        assert(skill, `Unknown skill ${key} in ${domain.id}/${workflow.id}`);
        assert(!skill.surfaceSlug || skill.surfaceSlug === workflow.surfaceSlug,
          `Skill ${key} is scoped to a different projection than ${workflow.id}`);
        return packageId("skill", domain.id, key);
      });
      return {
        ...scopedFields(domain, workflow, "workflow"),
        trigger: workflow.trigger,
        skillIds,
        approval: { reviewer: workflow.approval.reviewer, requiredFor: workflow.approval.requiredFor },
        output: workflow.output,
        verification: workflow.verification,
      };
    });
    skills.push(...domainSkills);
    workflows.push(...domainWorkflows);
    return {
      id: domain.id,
      name: domain.name,
      workbenchId: domain.workbenchId,
      projectionSlugs: domain.projectionSlugs,
      skillIds: domainSkills.map((skill) => skill.id),
      workflowIds: domainWorkflows.map((workflow) => workflow.id),
    };
  });
  assert.deepEqual(workbenchIds.sort(), [...workbenchById.keys()].sort(), "Domain packs must cover every Workbench package once");
  assert(packs.some(({ id }) => id === platformDomain), "Missing Platform & Administration domain");
  return {
    skills,
    workflows,
    index: {
      marketplace: "internal",
      published: true,
      delivery: "catalog-template",
      source: { revision: source.revision, path: source.path },
      shared: sharedDomainDependencies,
      packs,
    },
  };
}

function scopedFields(domain, item, kind) {
  if (item.surfaceSlug !== undefined) {
    assert(domain.projectionSlugs.includes(item.surfaceSlug), `Unknown scoped projection: ${item.surfaceSlug}`);
  }
  return {
    id: packageId(kind, domain.id, item.id),
    kind,
    name: item.name,
    domainId: domain.id,
    ...(item.surfaceSlug !== undefined && { surfaceSlug: item.surfaceSlug }),
    delivery: "catalog-template",
    note: item.note,
  };
}

function packageId(kind, domainId, id) {
  return `${kind}-${domainId}-${id}`;
}
