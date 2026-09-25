import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks & calendar — SalesOS" },
      { name: "description", content: "Follow-ups, reminders, site visits and appointments." },
      { property: "og:title", content: "Tasks & calendar — SalesOS" },
      { property: "og:description", content: "Follow-ups, reminders and appointments." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Tasks and calendar"
        description="Follow-ups, reminders, site visits and appointments for you and your team."
      />
      <MilestonePlaceholder
        milestone="Milestone 2 · Core workflow"
        title="Daily work queue"
        bullets={[
          "Follow-up task created automatically when a lead is assigned",
          "Overdue follow-up alerts to managers",
          "Stage-specific tasks created after a transition",
          "Appointments and site visits with feedback capture",
        ]}
      />
    </>
  ),
});
