export type IndustryTemplate = {
  id: string;
  label: string;
  terms: { catalog: string; buyers: string };
  stages: string[];
};

/** Terminology per industry. The seven underlying pipeline stages stay fixed; only their labels change. */
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  { id: "real_estate", label: "Real estate", terms: { catalog: "Properties", buyers: "Buyers & matching" },
    stages: ["Qualification", "Discovery", "Shortlist", "Site visit", "Negotiation", "Closing", "Won"] },
  { id: "b2b_services", label: "B2B services", terms: { catalog: "Services", buyers: "Client needs" },
    stages: ["Qualification", "Discovery", "Solution design", "Proposal", "Negotiation", "Contracting", "Won"] },
  { id: "software_sales", label: "Software sales", terms: { catalog: "Products", buyers: "Requirements" },
    stages: ["Qualification", "Discovery", "Demo", "Technical evaluation", "Negotiation", "Procurement", "Won"] },
  { id: "saas", label: "SaaS product sales", terms: { catalog: "Plans", buyers: "Requirements" },
    stages: ["Qualification", "Discovery", "Demo", "Trial", "Negotiation", "Closing", "Won"] },
  { id: "b2c_products", label: "B2C product sales", terms: { catalog: "Products", buyers: "Customer preferences" },
    stages: ["Enquiry", "Needs", "Recommendation", "Trial / demo", "Offer", "Checkout", "Won"] },
  { id: "staffing", label: "Staffing & recruitment", terms: { catalog: "Open roles", buyers: "Client requirements" },
    stages: ["Qualification", "Discovery", "Candidate shortlist", "Interviews", "Terms", "Placement", "Won"] },
  { id: "book_sales", label: "Book sales", terms: { catalog: "Titles", buyers: "Reader / retailer needs" },
    stages: ["Enquiry", "Needs", "Title selection", "Sample copy", "Order terms", "Fulfilment", "Won"] },
  { id: "agriculture", label: "Agriculture produce", terms: { catalog: "Produce lots", buyers: "Buyer requirements" },
    stages: ["Enquiry", "Requirements", "Quality sample", "Price quote", "Negotiation", "Delivery", "Won"] },
  { id: "retreats", label: "Retreat sales", terms: { catalog: "Retreats", buyers: "Guest preferences" },
    stages: ["Enquiry", "Discovery", "Retreat match", "Consultation call", "Offer", "Deposit", "Booked"] },
  { id: "senior_living", label: "Senior living", terms: { catalog: "Residences", buyers: "Family requirements" },
    stages: ["Enquiry", "Needs assessment", "Shortlist", "Tour", "Care & pricing", "Move-in paperwork", "Moved in"] },
];

export function getTemplate(id?: string | null) {
  return INDUSTRY_TEMPLATES.find((t) => t.id === id) ?? INDUSTRY_TEMPLATES[0]!;
}

export const AUTONOMY_LEVELS = [
  { id: "suggest", label: "Suggest only", description: "AI drafts; a person approves every action." },
  { id: "low_risk", label: "Act on low-risk", description: "AI may score and tag automatically; messages and assignments need approval." },
  { id: "off", label: "Off", description: "No AI assistance." },
] as const;
