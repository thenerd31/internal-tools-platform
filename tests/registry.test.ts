import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getApps, setManifestsForTests } from "../src/platform/registry";
import {
  ensureRegistry,
  generateRegistrySource,
} from "../src/platform/registry/generate";
import type { AppManifest } from "../src/platform/registry/types";
import { actors } from "./helpers";

afterEach(() => setManifestsForTests(null));

describe("generateRegistrySource", () => {
  it("writes an empty array when no apps exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apps-"));
    const source = generateRegistrySource(dir);
    expect(source).toContain("export const manifests: AppManifest[] = [];");
  });

  it("imports each discovered manifest", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apps-"));
    fs.mkdirSync(path.join(dir, "kyc"));
    fs.writeFileSync(path.join(dir, "kyc", "manifest.ts"), "export default {}");
    const source = generateRegistrySource(dir);
    expect(source).toContain('import manifest0 from "../../apps/kyc/manifest";');
    expect(source).toContain("[manifest0]");
  });
});

describe("ensureRegistry", () => {
  it("rewrites a stale generated.ts when a new manifest appears", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apps-"));
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gen-")), "generated.ts");
    fs.mkdirSync(path.join(dir, "kyc"));
    fs.writeFileSync(path.join(dir, "kyc", "manifest.ts"), "export default {}");

    ensureRegistry(dir, out);
    expect(fs.readFileSync(out, "utf8")).toContain("kyc");
    expect(fs.readFileSync(out, "utf8")).not.toContain("refunds");

    fs.mkdirSync(path.join(dir, "refunds"));
    fs.writeFileSync(path.join(dir, "refunds", "manifest.ts"), "export default {}");
    ensureRegistry(dir, out);
    const rewritten = fs.readFileSync(out, "utf8");
    expect(rewritten).toContain("kyc");
    expect(rewritten).toContain("refunds");
  });
});

describe("getApps", () => {
  const apps: AppManifest[] = [
    { id: "kyc", name: "KYC", basePath: "/apps/kyc", roles: ["analyst"], nav: [], policies: {}, auditActions: [] },
    { id: "refunds", name: "Refunds", basePath: "/apps/refunds", roles: ["agent", "lead"], nav: [], policies: {}, auditActions: [] },
  ];

  it("filters by role", () => {
    setManifestsForTests(apps);
    expect(getApps(actors.analyst).map((a) => a.id)).toEqual(["kyc"]);
    expect(getApps(actors.agent).map((a) => a.id)).toEqual(["refunds"]);
    expect(getApps(actors.supervisor)).toEqual([]);
  });

  it("admin sees all apps", () => {
    setManifestsForTests(apps);
    expect(getApps(actors.admin)).toHaveLength(2);
  });
});
