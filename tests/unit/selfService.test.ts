import { describe, expect, it } from "vitest";
import { displayNameFromEmail } from "@/server/identity/selfService";
import { renderTemplate } from "@/server/mail/templates";

describe("self-service identity", () => {
  it("derives a friendly initial name without keeping an email tag", () => {
    expect(displayNameFromEmail("fiona.fellow+diary@example.org")).toBe("Fiona Fellow");
    expect(displayNameFromEmail("single@example.org")).toBe("Single");
  });

  it("describes the magic link as sign-up or sign-in", () => {
    const email = renderTemplate("magic_link", {
      verifyUrl: "https://example.org/auth/verify?token=test",
      expiryMinutes: "15",
    });
    expect(email?.subject).toBe("Your oPortfolio access link");
    expect(email?.text).toContain("sign in or create your private oPortfolio diary");
  });
});
