import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this app: the repo root has the kit's lockfile,
// which Next would otherwise (mis)infer as the root.
const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root },
  // FR-019 doc indexing: pdf-parse (pdf.js) and mammoth resolve sibling assets
  // (e.g. pdf.worker.mjs) relative to their own node_modules location. Bundling
  // them into .next/server/chunks breaks that lookup at runtime ("Cannot find
  // module '…/pdf.worker.mjs'"), so keep them external and loaded from disk.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
