import { afterEach, describe, expect, it } from "vitest";
import { buildProviders } from "../src/platform/auth/providers";

afterEach(() => {
  delete process.env.AUTH_OIDC_ISSUER;
});

describe("buildProviders", () => {
  it("registers only Credentials when AUTH_OIDC_ISSUER is unset", () => {
    delete process.env.AUTH_OIDC_ISSUER;
    const providers = buildProviders();
    expect(providers).toHaveLength(1);
  });

  it("adds the OIDC provider when AUTH_OIDC_ISSUER is set", () => {
    process.env.AUTH_OIDC_ISSUER = "https://issuer.example.com";
    const providers = buildProviders();
    expect(providers).toHaveLength(2);
    expect((providers[1] as { id?: string }).id).toBe("oidc");
  });
});
