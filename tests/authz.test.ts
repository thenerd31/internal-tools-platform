import { afterEach, describe, expect, it } from "vitest";
import { authorize, runAction } from "../src/platform/authz";
import { ConflictError, ForbiddenError, ValidationError } from "../src/platform/errors";
import { setManifestsForTests } from "../src/platform/registry";
import type { AppManifest } from "../src/platform/registry/types";
import { actors } from "./helpers";

const manifest: AppManifest = {
  id: "kyc",
  name: "KYC",
  basePath: "/apps/kyc",
  roles: ["analyst", "supervisor"],
  nav: [],
  auditActions: ["kyc.case.claim"],
  policies: {
    "kyc.case.claim": (actor) => actor.role === "analyst" || actor.role === "supervisor",
    "kyc.case.decide": (actor, resource) =>
      actor.role === "analyst" &&
      (resource as { riskScore: number }).riskScore < 70,
  },
};

afterEach(() => setManifestsForTests(null));

describe("authorize", () => {
  it("allows when the policy returns true", () => {
    setManifestsForTests([manifest]);
    expect(() => authorize(actors.analyst, "kyc.case.claim")).not.toThrow();
  });

  it("denies with ForbiddenError when the policy returns false", () => {
    setManifestsForTests([manifest]);
    expect(() => authorize(actors.agent, "kyc.case.claim")).toThrow(ForbiddenError);
    expect(() =>
      authorize(actors.analyst, "kyc.case.decide", { riskScore: 80 }),
    ).toThrow(ForbiddenError);
  });

  it("denies unknown actions for everyone including admin", () => {
    setManifestsForTests([manifest]);
    expect(() => authorize(actors.analyst, "kyc.nope")).toThrow(ForbiddenError);
    expect(() => authorize(actors.admin, "kyc.nope")).toThrow(ForbiddenError);
  });

  it("lets admin pass every known policy", () => {
    setManifestsForTests([manifest]);
    expect(() =>
      authorize(actors.admin, "kyc.case.decide", { riskScore: 80 }),
    ).not.toThrow();
  });
});

describe("runAction", () => {
  it("returns { ok: true, data } on success", async () => {
    const res = await runAction(() => 42);
    expect(res).toEqual({ ok: true, data: 42 });
  });

  it.each([
    [new ForbiddenError("no"), 403],
    [new ValidationError("bad input"), 422],
    [new ConflictError(), 409],
  ])("maps %s to { ok: false, code }", async (err, code) => {
    const res = await runAction(() => {
      throw err;
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(code);
      expect(res.message).toBe(err.message);
    }
  });

  it("rethrows non-platform errors", async () => {
    await expect(
      runAction(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
