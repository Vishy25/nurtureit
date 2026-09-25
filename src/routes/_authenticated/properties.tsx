import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MilestonePlaceholder } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "Properties — SalesOS" },
      { name: "description", content: "Property and offering catalog with availability, pricing and media." },
      { property: "og:title", content: "Properties — SalesOS" },
      { property: "og:description", content: "Property and offering catalog." },
    ],
  }),
  component: () => (
    <>
      <PageHeader
        title="Properties and offerings"
        description="The catalog behind shortlists, matching and opportunity line items."
      />
      <MilestonePlaceholder
        milestone="Milestone 2 · Core workflow"
        title="Property catalog"
        bullets={[
          "Project, unit, location, type, area, bedrooms, amenities and price",
          "Availability and listing status, developer or seller relationships",
          "Media and documents, buyer shortlists and matching",
          "Transaction value kept separate from brokerage revenue and commission",
        ]}
      />
    </>
  ),
});
