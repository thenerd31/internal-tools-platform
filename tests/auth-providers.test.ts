import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSecret } from "../src/platform/auth/config";
import { buildProviders } from "../src/platform/auth/providers";

afterEach(() => {
  vi.unstubAllEnvs();
});

function providerIds() {
  return buildProviders().map((p) => (p as { id?: string }).id);
}

describe("buildProviders", () => {
  it("registers only Credentials when AUTH_OIDC_ISSUER is unset", () => {
    vi.stubEnv("AUTH_OIDC_ISSUER", "");
    expect(providerIds()).toEqual(["credentials"]);
  });

  it("adds the OIDC provider when AUTH_OIDC_ISSUER is set", () => {
    vi.stubEnv("AUTH_OIDC_ISSUER", "https://issuer.example.com");
    expect(providerIds()).toEqual(["credentials", "oidc"]);
  });

  it("omits Credentials when NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_OIDC_ISSUER", "https://issuer.example.com");
    expect(providerIds()).toEqual(["oidc"]);
  });

  it("keeps Credentials in production when AUTH_ALLOW_DEV_LOGIN=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_ALLOW_DEV_LOGIN", "true");
    expect(providerIds()).toContain("credentials");
  });
});

describe("resolveSecret", () => {
  it("returns AUTH_SECRET when set", () => {
    vi.stubEnv("AUTH_SECRET", "real-secret");
    expect(resolveSecret()).toBe("real-secret");
  });

  it("throws at startup when unset in production", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveSecret()).toThrow("AUTH_SECRET is required");
  });

  it("falls back to the dev constant outside production", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(resolveSecret()).toBe("dev-only-insecure-secret");
  });
});
