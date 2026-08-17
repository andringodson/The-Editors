/**
 * Official photo specifications.
 *
 * Dimensions are stored in millimetres because that is how every issuing
 * authority publishes them; pixels are derived at whatever DPI the user picks.
 * Print submissions generally want 300 DPI, online portals often cap file size
 * instead — which is why each preset also carries a suggested byte budget that
 * feeds straight into the compressor.
 */

export interface PhotoPreset {
  id: string;
  label: string;
  region: string;
  widthMm: number;
  heightMm: number;
  /** Typical upload limit for the matching online portal, in bytes. */
  suggestedMaxBytes?: number;
  note?: string;
}

export const PHOTO_PRESETS: PhotoPreset[] = [
  {
    id: "passport-in",
    label: "Passport — India",
    region: "IN",
    widthMm: 35,
    heightMm: 45,
    suggestedMaxBytes: 20 * 1024,
    note: "Also accepted for PAN, Aadhaar and most state portals.",
  },
  {
    id: "passport-us",
    label: "Passport — United States",
    region: "US",
    widthMm: 50.8,
    heightMm: 50.8,
    note: "2×2 inches, square. Head must occupy 25–35 mm of the frame.",
  },
  {
    id: "passport-schengen",
    label: "Passport — Schengen / EU",
    region: "EU",
    widthMm: 35,
    heightMm: 45,
  },
  {
    id: "passport-uk",
    label: "Passport — United Kingdom",
    region: "GB",
    widthMm: 35,
    heightMm: 45,
  },
  {
    id: "visa-cn",
    label: "Visa — China",
    region: "CN",
    widthMm: 33,
    heightMm: 48,
  },
  {
    id: "stamp-in",
    label: "Stamp size",
    region: "IN",
    widthMm: 20,
    heightMm: 25,
    suggestedMaxBytes: 20 * 1024,
    note: "The small photo used alongside passport size on Indian forms.",
  },
  {
    id: "signature-in",
    label: "Signature",
    region: "IN",
    widthMm: 35,
    heightMm: 15,
    suggestedMaxBytes: 10 * 1024,
    note: "Standard signature box for Indian exam and bank portals.",
  },
];

export const DPI_OPTIONS = [200, 300, 600] as const;
export type Dpi = (typeof DPI_OPTIONS)[number];

const MM_PER_INCH = 25.4;

export function mmToPixels(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export function presetPixelSize(
  preset: PhotoPreset,
  dpi: number,
): { width: number; height: number } {
  return {
    width: mmToPixels(preset.widthMm, dpi),
    height: mmToPixels(preset.heightMm, dpi),
  };
}

export function presetAspectRatio(preset: PhotoPreset): number {
  return preset.widthMm / preset.heightMm;
}

export function findPreset(id: string): PhotoPreset | undefined {
  return PHOTO_PRESETS.find((preset) => preset.id === id);
}
