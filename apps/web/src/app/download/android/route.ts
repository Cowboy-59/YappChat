import { NextResponse } from "next/server";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { presignShare, storageConfigured } from "@/lib/storage/s3";

/**
 * Spec 068 delta — permanent Android download link (the dashboard QR encodes this).
 *
 * Public on purpose: the QR is scanned from a phone that isn't signed in. Redirects
 * to a presigned GET of a FIXED key in the private media bucket, so shipping a new
 * build is just uploading over that key — no code/env change or redeploy. (EAS
 * artifact URLs expire after 14 days, which is why we don't link to them directly.)
 */
export const dynamic = "force-dynamic";

const ANDROID_APK_KEY = "downloads/android/yappchat.apk";

/** Any failure counts as missing — without s3:ListBucket, S3 answers 403 for an absent key. */
async function apkExists(): Promise<boolean> {
  try {
    await new S3Client({ region: process.env.AWS_REGION }).send(
      new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: ANDROID_APK_KEY }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!storageConfigured() || !(await apkExists())) {
    return new NextResponse("The Android app isn't available right now.", { status: 404 });
  }
  const url = await presignShare(ANDROID_APK_KEY, { downloadName: "YappChat.apk" });
  return NextResponse.redirect(url, 302);
}
