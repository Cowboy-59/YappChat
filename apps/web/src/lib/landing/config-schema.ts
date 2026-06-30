import { z } from "zod";

/**
 * Spec 012 — Public Landing Page.
 * Zod schemas gating each jsonb section of `landingpageconfig` on write.
 * Malformed config -> 422 at the API layer (T004).
 *
 * Each section is exported individually so PATCH can validate partial updates,
 * and the whole config is composed from them for reads/seed.
 */

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex colour")
  .optional();

/** Allow a real URL, a root-relative path, or an empty string ("Coming soon"). */
const urlOrBlank = z
  .string()
  .refine(
    (v) => v === "" || /^https?:\/\//.test(v) || v.startsWith("/"),
    "must be an absolute URL, a root-relative path, or blank",
  );

export const brandingSchema = z.object({
  companyname: z.string().min(1).max(80),
  logourl: urlOrBlank.default(""),
  heroheadline: z.string().min(1).max(140),
  herosubheadline: z.string().min(1).max(280),
  primarycolor: hexColor,
  accentcolor: hexColor,
  contactemail: z.string().email(),
  githuburl: urlOrBlank.default(""),
  termsurl: urlOrBlank.default(""),
  privacyurl: urlOrBlank.default(""),
});

export const seoSchema = z.object({
  title: z.string().min(1).max(70),
  description: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1)).max(20).default([]),
  canonicalurl: urlOrBlank.default(""),
  ogimageurl: urlOrBlank.default(""),
  twitterhandle: z.string().max(40).default(""),
  disallowindexing: z.boolean().default(false),
});

export const planSchema = z.object({
  id: z.enum(["individual", "corporate"]),
  name: z.string().min(1).max(60),
  displayprice: z.string().min(1).max(40),
  billinginterval: z.string().min(1).max(60),
  features: z.array(z.string().min(1)).min(1).max(20),
  ctalabel: z.string().min(1).max(40),
  /** Must route to spec 011 signup with the plan param (validated below). */
  ctapath: z
    .string()
    .regex(/^\/signup\?plan=(individual|corporate)$/, "must be /signup?plan=<plan>"),
  highlighted: z.boolean().default(false),
});

export const plansSchema = z.array(planSchema).min(1).max(4);

export const featureSchema = z.object({
  /** Deep-link anchor id, e.g. "feature-pa". */
  id: z.string().regex(/^feature-[a-z0-9-]+$/, "must look like feature-<slug>"),
  /** lucide-react icon name. */
  icon: z.string().min(1).max(40),
  headline: z.string().min(1).max(60),
  body: z.string().min(1).max(200),
  /** Optional per-card call-to-action (e.g. the self-host download → signup). */
  cta: z
    .object({
      label: z.string().min(1).max(40),
      href: z.string().min(1).max(200),
    })
    .optional(),
});

export const featuresSchema = z.array(featureSchema).min(1).max(12);

export const securitySchema = z.object({
  headline: z.string().min(1).max(120),
  bullets: z.array(z.string().min(1).max(240)).min(3).max(8),
});

export const faqItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase slug"),
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(1000),
});

export const faqSchema = z.array(faqItemSchema).max(30).default([]);

export const testimonialSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase slug"),
  quote: z.string().min(1).max(500),
  author: z.string().min(1).max(80),
  role: z.string().max(80).default(""),
  company: z.string().max(80).default(""),
  avatarurl: urlOrBlank.default(""),
});

export const testimonialsSchema = z.array(testimonialSchema).max(20).default([]);

export const platformDownloadSchema = z.object({
  available: z.boolean(),
  url: urlOrBlank.default(""),
  comingsoonnote: z.string().max(120).default(""),
});

export const downloadsSchema = z.object({
  ios: platformDownloadSchema,
  android: platformDownloadSchema,
  desktop: platformDownloadSchema,
});

/** The full editable config (all jsonb sections). */
export const landingConfigSchema = z.object({
  branding: brandingSchema,
  seo: seoSchema,
  plans: plansSchema,
  features: featuresSchema,
  security: securitySchema,
  faq: faqSchema,
  testimonials: testimonialsSchema,
  downloads: downloadsSchema,
});

/** PATCH accepts any subset of sections; each present section is fully validated. */
export const landingConfigPatchSchema = landingConfigSchema.partial();

export type Branding = z.infer<typeof brandingSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Feature = z.infer<typeof featureSchema>;
export type Security = z.infer<typeof securitySchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
export type Testimonial = z.infer<typeof testimonialSchema>;
export type Downloads = z.infer<typeof downloadsSchema>;
export type LandingConfig = z.infer<typeof landingConfigSchema>;
export type LandingConfigPatch = z.infer<typeof landingConfigPatchSchema>;

/**
 * Public projection — the subset safe to expose unauthenticated.
 * NEVER includes admin-only/audit fields (`updatedby`, `updatedat`, row id).
 * All sections here are intended to render in public HTML.
 */
export type PublicLandingConfig = LandingConfig;

export function toPublicConfig(config: LandingConfig): PublicLandingConfig {
  // Currently every editable section is public-safe; this function is the single
  // choke point to strip fields if admin-only sections are added later.
  return config;
}
