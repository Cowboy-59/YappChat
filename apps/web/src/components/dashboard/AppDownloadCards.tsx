import QRCode from "qrcode";
import { getSiteUrl } from "@/lib/site";

/**
 * Native-app install cards for the dashboard "Jump in" grid: an Android card with
 * a scannable QR to the current build, and an iOS "coming soon" placeholder.
 *
 * The QR and the card both point at our permanent `/download/android` route, which
 * redirects to the APK stored at a fixed S3 key (spec 068 delta). A new build is
 * shipped by uploading over that key — this URL never changes.
 */

/** Async server component — renders the QR to a data URL at request time. */
export async function AppDownloadCards() {
  const ANDROID_APK_URL = `${getSiteUrl()}/download/android`;
  const qr = await QRCode.toDataURL(ANDROID_APK_URL, { margin: 1, width: 240 });

  return (
    <>
      {/* Android — scan to install */}
      <a
        href={ANDROID_APK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code to download the Android app" width={56} height={56} className="rounded-md" />
        <div className="min-w-0">
          <div className="text-sm font-semibold">Android app</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Scan to download</div>
        </div>
      </a>

      {/* iOS — coming soon (disabled placeholder) */}
      <div
        aria-disabled="true"
        className="flex flex-col justify-center rounded-xl border border-dashed border-border bg-card/50 p-4 opacity-70"
      >
        <div className="text-sm font-semibold text-muted-foreground">iOS app</div>
        <div className="mt-0.5 text-xs text-muted-foreground">Coming soon</div>
      </div>
    </>
  );
}
