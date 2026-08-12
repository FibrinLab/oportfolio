// Email templates. Neutral metadata only: a login link and generic wording —
// never portfolio content, names of items, or narrative (spec/07, spec/12).

export interface RenderedEmail {
  subject: string;
  text: string;
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>,
): RenderedEmail | null {
  switch (template) {
    case "magic_link":
      return {
        subject: "Your oPortfolio sign-in link",
        text: [
          "Use this link to sign in to oPortfolio:",
          "",
          variables.verifyUrl ?? "",
          "",
          `The link expires in ${variables.expiryMinutes ?? "15"} minutes and can be used once.`,
          "If you did not request it, you can ignore this email.",
        ].join("\n"),
      };
    case "invitation":
      return {
        subject: "You have been invited to oPortfolio",
        text: [
          "You have been invited to join oPortfolio, the learning portfolio for the NHS Fellowship in Clinical AI.",
          "",
          "Accept your invitation:",
          variables.inviteUrl ?? "",
          "",
          `The invitation expires in ${variables.expiryDays ?? "7"} days.`,
          "If you were not expecting this, contact your programme team.",
        ].join("\n"),
      };
    default:
      return null;
  }
}
