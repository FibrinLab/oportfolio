import type { Metadata } from "next";
import { DemoSignIn } from "./DemoSignIn";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const demoMode = process.env.DEMO_LOGIN === "true";
  return (
    <main
      style={{
        maxWidth: "34rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--gutter)",
      }}
    >
      <h1 style={{ marginBottom: "var(--space-2)" }}>oPortfolio</h1>
      <p style={{ marginBottom: "var(--space-6)" }}>
        Learning portfolio for the NHS Fellowship in Clinical AI.
      </p>
      <SignInForm />
      {demoMode ? <DemoSignIn /> : null}
      <p
        style={{
          marginTop: "var(--space-6)",
          fontSize: "var(--text-sm)",
          color: "var(--disabled-text)",
        }}
      >
        Accounts are created by programme faculty invitation. If you are expecting an
        invitation and have not received it, contact your programme team.
      </p>
    </main>
  );
}
