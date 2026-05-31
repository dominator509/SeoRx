import { describe, expect, it } from "vitest";
import {
  isLikelyValidClerkPublishableKey,
  isLikelyValidClerkSecretKey,
  shouldEnableClerkAuth,
} from "../lib/clerk-config";

describe("clerk-config", () => {
  it("rejects placeholder or short keys", () => {
    expect(isLikelyValidClerkPublishableKey("pk_test_x")).toBe(false);
    expect(isLikelyValidClerkSecretKey("sk_test_x")).toBe(false);
    expect(isLikelyValidClerkPublishableKey("pk_test_replace_me")).toBe(false);
    expect(isLikelyValidClerkSecretKey("sk_test_replace_me")).toBe(false);
  });

  it("accepts likely real key shapes", () => {
    expect(isLikelyValidClerkPublishableKey("pk_test_1234567890abcdef")).toBe(true);
    expect(isLikelyValidClerkSecretKey("sk_live_1234567890abcdef")).toBe(true);
  });

  it("enables auth only when both keys are valid", () => {
    expect(shouldEnableClerkAuth({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      shouldEnableClerkAuth({
        CLERK_PUBLISHABLE_KEY: "pk_test_1234567890abcdef",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      shouldEnableClerkAuth({
        CLERK_PUBLISHABLE_KEY: "pk_test_1234567890abcdef",
        CLERK_SECRET_KEY: "sk_test_1234567890abcdef",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
