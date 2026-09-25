import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAGES = [
  "Qualification confirmed",
  "Needs discovery completed",
  "Property shortlist agreed",
  "Site visit and evaluation",
  "Offer and negotiation",
  "Contract and closing preparation",
  "Closed won",
];

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — SalesOS" },
      { name: "description", content: "The seven-stage opportunity pipeline with server-enforced transition rules." },
      { property: "og:title", content: "Pipeline — SalesOS" },
      { property: "og:description", content: "Seven-stage opportunity pipeline with transition rules." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Pipeline"
        description="Opportunities move through configurable stages with required fields, checklists and recorded history."
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Default real estate stages (buyer sales)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage, i) => (
            <div key={stage} className="rounded-md border border-border bg-secondary/50 p-3">
              <p className="text-xs font-semibold text-accent">Stage {i + 1}</p>
              <p className="text-sm">{stage}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <MilestonePlaceholder
        milestone="Milestone 2 · Core workflow"
        title="Deal board"
        bullets={[
          "Drag-and-drop stage changes that respect transition rules",
          "Closed-lost from any active stage with a required reason",
          "Nurturing and on-hold as separate states with a follow-up date",
          "Stage history retained for accurate reporting",
        ]}
      />
    </>
  ),
});
