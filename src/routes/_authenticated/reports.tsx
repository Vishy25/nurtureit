import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SalesOS" },
      { name: "description", content: "Conversion, pipeline health, performance and revenue reporting." },
      { property: "og:title", content: "Reports — SalesOS" },
      { property: "og:description", content: "Conversion, pipeline health and revenue reporting." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Reports"
        description="Documented metric definitions, reconciled with the underlying records."
      />
      <MilestonePlaceholder
        milestone="Milestone 4 · Intelligence"
        title="Reporting suite"
        bullets={[
          "Stage conversion and time in stage from retained stage history",
          "Open and weighted pipeline, expected versus realized brokerage revenue",
          "Team and agent performance, loss reasons",
          "No summing of different currencies without an explicit conversion policy",
        ]}
      />
    </>
  ),
});
