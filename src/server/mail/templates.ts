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
        subject: "Your oPortfolio access link",
        text: [
          "Use this link to sign in or create your private oPortfolio diary:",
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
          "You have been invited to join oPortfolio, the private reflective diary for the NHS Fellowship in Clinical AI.",
          "",
          "Accept your invitation:",
          variables.inviteUrl ?? "",
          "",
          `The invitation expires in ${variables.expiryDays ?? "7"} days.`,
          "If you were not expecting this, contact your programme team.",
        ].join("\n"),
      };
    case "diary_export_ready":
      return {
        subject: "Your diary export is ready",
        text: [
          "Your private diary export is ready.",
          "",
          `Sign in to download it: ${variables.appUrl ?? ""}`,
          "",
          "The message contains no diary content. Keep the downloaded archive secure.",
        ].join("\n"),
      };
    case "diary_deletion_reminder":
      return {
        subject: `Your diary will be deleted in ${variables.daysRemaining ?? "a few"} day(s)`,
        text: [
          `Your finished diary is scheduled for deletion in ${variables.daysRemaining ?? "a few"} day(s).`,
          "",
          `Sign in to download it or reopen the diary: ${variables.appUrl ?? ""}`,
          "",
          "This message contains no diary content.",
        ].join("\n"),
      };
    default:
      return null;
  }
}
