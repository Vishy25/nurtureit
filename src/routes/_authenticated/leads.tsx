import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — SalesOS" },
      { name: "description", content: "Qualified lead intake, scoring, assignment and follow-up in SalesOS." },
      { property: "og:title", content: "Leads — SalesOS" },
      { property: "og:description", content: "Qualified lead intake, scoring and follow-up." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry with its source, qualification, score, owner, status and next action."
      />
      <MilestonePlaceholder
        milestone="Milestone 2 · Core workflow"
        title="Lead workspace"
        bullets={[
          "Sortable lead table with saved filters and bulk assignment",
          "Lifecycle statuses: new, accepted, nurturing, disqualified, converted",
          "Conversion that preserves source attribution and history",
          "Duplicate review scoped to your workspace only",
        ]}
      />
    </>
  ),
});
