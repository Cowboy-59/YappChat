import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this app: the repo root has the kit's lockfile,
// which Next would otherwise (mis)infer as the root.
const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root },
};

export default nextConfig;
