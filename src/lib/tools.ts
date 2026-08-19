/**
 * Tool registry — the single source of truth for navigation, the landing page
 * grid, and the telemetry `tool_id`. Adding a tool means adding it here.
 */

export type ToolCategory = "image" | "pdf" | "convert";
export type ToolStatus = "live" | "soon";

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  category: ToolCategory;
  status: ToolStatus;
  /** Runs fully on-device. False means it depends on the conversion service. */
  clientSide: boolean;
}

/**
 * A server-dependent tool is only genuinely available when the conversion
 * service is wired up, so availability is resolved at render time rather than
 * baked into the registry.
 */
export function effectiveStatus(
  tool: ToolDefinition,
  converterConfigured: boolean,
): ToolStatus {
  if (!tool.clientSide && !converterConfigured) return "soon";
  return tool.status;
}

/** The order categories are presented in, and therefore numbered in. */
export const CATEGORY_ORDER: ToolCategory[] = ["image", "pdf", "convert"];

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  image: "Images",
  pdf: "PDF",
  convert: "Convert",
};

export const TOOLS: ToolDefinition[] = [
  {
    id: "compress",
    slug: "compress",
    name: "Compress to a size",
    blurb:
      "Name a target — 200 KB, 2 MB — and get the best-looking image that fits under it.",
    category: "image",
    status: "live",
    clientSide: true,
  },
  {
    id: "passport",
    slug: "passport",
    name: "Passport & stamp photos",
    blurb:
      "Exact millimetre sizes for passports, visas, stamp and signature boxes.",
    category: "image",
    status: "live",
    clientSide: true,
  },
  {
    id: "pdf-merge",
    slug: "pdf-merge",
    name: "Merge PDFs",
    blurb: "Combine any number of PDFs, reorder before you export.",
    category: "pdf",
    status: "live",
    clientSide: true,
  },
  {
    id: "images-to-pdf",
    slug: "images-to-pdf",
    name: "Images to PDF",
    blurb: "Turn phone photos or scans into one tidy A4 document.",
    category: "pdf",
    status: "live",
    clientSide: true,
  },
  {
    id: "crop",
    slug: "crop",
    name: "Crop & straighten",
    blurb: "Freehand or fixed-ratio cropping, with rotation to level a scan.",
    category: "image",
    status: "live",
    clientSide: true,
  },
  {
    id: "upscale",
    slug: "upscale",
    name: "Upscale to 4K",
    blurb: "Enlarge to 4K with high-quality resampling.",
    category: "image",
    status: "live",
    clientSide: true,
  },
  {
    id: "format",
    slug: "format",
    name: "Change format",
    blurb: "JPG, PNG, WebP and AVIF, converted both ways.",
    category: "convert",
    status: "live",
    clientSide: true,
  },
  {
    id: "office-to-pdf",
    slug: "office-to-pdf",
    name: "Office to PDF",
    blurb:
      "PowerPoint, Word and Excel into PDF. The one job a browser can't do.",
    category: "convert",
    status: "live",
    clientSide: false,
  },
];

export const LIVE_TOOLS = TOOLS.filter((tool) => tool.status === "live");

export function toolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function toolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.category === category);
}

/**
 * Every tool in presentation order.
 *
 * The landing grid and each tool page both label tools "01", "02" and so on.
 * Deriving that from one list here means the number a tool carries on the grid
 * is the number it carries on its own page — computing it separately in two
 * places is how they end up disagreeing.
 */
export const ORDERED_TOOLS: ToolDefinition[] = CATEGORY_ORDER.flatMap(
  (category) => TOOLS.filter((tool) => tool.category === category),
);

export function toolOrdinal(tool: ToolDefinition): string {
  return String(ORDERED_TOOLS.indexOf(tool) + 1).padStart(2, "0");
}
