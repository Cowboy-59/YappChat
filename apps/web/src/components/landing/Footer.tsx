import { Github } from "lucide-react";
import type { PublicLandingConfig } from "@/lib/landing/config-schema";
import { getAppVersion } from "@/lib/site";
import { AppsDownloadModal } from "./AppsDownloadModal";

/**
 * Spec 012 T006 — Footer (FR-017).
 * Company name + logo, contact email, GitHub, version string, legal links
 * (Terms / Privacy — "Coming soon" inline when URL is blank), a redundant
 * "Sign in" link, and a "Get the apps" trigger (AppsDownloadModal).
 */
export function Footer({ config }: { config: PublicLandingConfig }) {
  const { branding, downloads } = config;
  const version = getAppVersion();

  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="flex flex-col gap-3">
            {branding.logourl ? (
              // eslint-disable-next-line @next/next/no-img-element -- config-driven logo
              <img
                src={branding.logourl}
                alt={`${branding.companyname} logo`}
                className="h-8 w-auto"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
                {branding.companyname}
              </span>
            )}
            <a
              href={`mailto:${branding.contactemail}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {branding.contactemail}
            </a>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3"
          >
            <LegalLink label="Terms" url={branding.termsurl} />
            <LegalLink label="Privacy" url={branding.privacyurl} />
            <a
              href="/signin"
              data-analytics="signin"
              className="text-muted-foreground hover:text-foreground"
            >
              Sign in
            </a>
            <AppsDownloadModal downloads={downloads} />
            {branding.githuburl ? (
              <a
                href={branding.githuburl}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Github aria-hidden className="h-4 w-4" />
                GitHub
              </a>
            ) : null}
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>
            © {branding.companyname}. All rights reserved.
          </span>
          <span>Version {version}</span>
        </div>
      </div>
    </footer>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  if (!url) {
    return (
      <span className="text-muted-foreground">
        {label} <span className="italic">(Coming soon)</span>
      </span>
    );
  }
  return (
    <a href={url} className="text-muted-foreground hover:text-foreground">
      {label}
    </a>
  );
}
