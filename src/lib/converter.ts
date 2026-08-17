/**
 * Configuration for the external conversion service.
 *
 * Like Supabase, this is optional: with no URL set the Office→PDF tool reports
 * itself unavailable and every other tool is unaffected, because nothing else
 * depends on a server.
 */

export const converterUrl = process.env.NEXT_PUBLIC_CONVERTER_URL ?? "";
export const isConverterConfigured = Boolean(converterUrl);

export const OFFICE_EXTENSIONS = [
  "ppt", "pptx", "odp",
  "doc", "docx", "odt", "rtf",
  "xls", "xlsx", "ods", "csv",
] as const;

export const OFFICE_ACCEPT = OFFICE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/** Matches the service's own ceiling in services/converter/src/convert.ts. */
export const MAX_OFFICE_BYTES = 50 * 1024 * 1024;
