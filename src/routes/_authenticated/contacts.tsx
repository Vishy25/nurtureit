import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts & organizations — SalesOS" },
      { name: "description", content: "People and organizations with a unified activity history." },
      { property: "og:title", content: "Contacts & organizations — SalesOS" },
      { property: "og:description", content: "People and organizations with a unified history." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Contacts and organizations"
        description="People, the organizations they belong to, their communication preferences and full history."
      />
      <MilestonePlaceholder
        milestone="Milestone 2 · Core workflow"
        title="Contact records"
        bullets={[
          "Multiple contacts per organization with relationships",
          "Communication preferences and consent provenance",
          "Unified timeline of notes, calls, messages and meetings",
        ]}
      />
    </>
  ),
});
