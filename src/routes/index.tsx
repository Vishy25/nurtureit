import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SalesOS CRM — Workspace" },
    { name: "description", content: "SalesOS CRM workspaces for leads, contacts, property enquiries and sales pipelines." },
    { property: "og:title", content: "SalesOS CRM — Workspace" },
    { property: "og:description", content: "Manage connected sales workflows in your SalesOS workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
