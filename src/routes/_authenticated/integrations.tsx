import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — SalesOS" },
      { name: "description", content: "Inbound lead intake, email, calendar, messaging and e-signature connections." },
      { property: "og:title", content: "Integrations — SalesOS" },
      { property: "og:description", content: "Lead intake and provider connections." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Integrations"
        description="Connection states are always honest: nothing is shown as connected until real credentials work."
      />
      <MilestonePlaceholder
        milestone="Milestone 3 · Agent intake"
        title="Inbound lead API and providers"
        bullets={[
          "Versioned intake endpoint with workspace-scoped credentials, rotation and revocation",
          "Idempotency, replay protection, rate limits and a failed-event review queue",
          "Email, calendar, SMS/WhatsApp, telephony, e-signature and listing feeds added as credentials become available",
        ]}
      />
    </>
  ),
});
