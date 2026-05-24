/**
 * YappChat avatar library registry.
 * All built-in assets are CC0 (public domain) or MIT — safe for commercial use.
 *
 * Sources:
 *   Molty         — OpenClaw pixel lobster (MIT)
 *   cat–biden     — Original 16×16 pixel art for YappChat (CC0)
 *
 * To add more from the Kenney Animal Pack Redux (CC0, 30 animals + SVGs):
 *   Download from https://kenney.nl/assets/animal-pack-redux
 *   Add the SVG to this directory and register it below.
 *
 * User-imported avatars (uploaded files or URL imports) are NOT stored here —
 * they live in the database / file store and are returned from
 * GET /api/avatar/library under the `mine` key alongside `builtin`.
 */

/**
 * The only permitted display sizes for AvatarDisplay.
 * Passing any other value is a TypeScript compile error.
 *
 * 24  — inline message sender icon, compact directory rows
 * 32  — OrgDirectoryTree node, member card thumbnail
 * 64  — PA sidebar, picker grid cells, video call tile
 * 128 — PAFullChatView header (large featured avatar)
 */
export type AvatarSize = 24 | 32 | 64 | 128;

export const AVATAR_SIZES: readonly AvatarSize[] = [24, 32, 64, 128] as const;

export function isValidAvatarSize(n: number): n is AvatarSize {
  return (AVATAR_SIZES as readonly number[]).includes(n);
}

export type AvatarLibraryItem = {
  key: string;
  name: string;
  /** URL path — built-ins use /assets/avatars/:file; imported use /api/avatar/assets/:key */
  file: string;
  source: "openclaw" | "yappchat-original" | "custom" | "imported";
  license: "MIT" | "CC0" | "user-owned";
};

/**
 * Response shape from GET /api/avatar/library.
 * `builtin` = the 14 shipped avatars below.
 * `mine` = avatars the current user has imported (file upload or URL).
 */
export type AvatarLibraryResponse = {
  builtin: AvatarLibraryItem[];
  mine: AvatarLibraryItem[];
};

export const AVATAR_LIBRARY: AvatarLibraryItem[] = [
  {
    key: "molty",
    name: "Molty",
    file: "/assets/avatars/molty.svg",
    source: "openclaw",
    license: "MIT",
  },
  {
    key: "cat",
    name: "Cat",
    file: "/assets/avatars/cat.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "dog",
    name: "Dog",
    file: "/assets/avatars/dog.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "fox",
    name: "Fox",
    file: "/assets/avatars/fox.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "rabbit",
    name: "Rabbit",
    file: "/assets/avatars/rabbit.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "penguin",
    name: "Penguin",
    file: "/assets/avatars/penguin.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "panda",
    name: "Panda",
    file: "/assets/avatars/panda.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "parrot",
    name: "Parrot",
    file: "/assets/avatars/parrot.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "monkey",
    name: "Monkey",
    file: "/assets/avatars/monkey.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "elephant",
    name: "Elephant",
    file: "/assets/avatars/elephant.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "pig",
    name: "Pig",
    file: "/assets/avatars/pig.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "frog",
    name: "Frog",
    file: "/assets/avatars/frog.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "prezTrump",
    name: "Prez Trump",
    file: "/assets/avatars/prezTrump.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "prezTrumpfull",
    name: "Prez Trump (large)",
    file: "/assets/avatars/prezTrumpfull.svg",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "prezTrumpPng",
    name: "Prez Trump (PNG)",
    file: "/assets/avatars/prezTrump.png",
    source: "yappchat-original",
    license: "CC0",
  },
  {
    key: "biden",
    name: "Biden",
    file: "/assets/avatars/biden.svg",
    source: "yappchat-original",
    license: "CC0",
  },
];

export const DEFAULT_AVATAR_KEY = "molty";

export function getAvatar(key: string): AvatarLibraryItem | undefined {
  return AVATAR_LIBRARY.find((a) => a.key === key);
}

export function getDefaultAvatar(): AvatarLibraryItem {
  return AVATAR_LIBRARY.find((a) => a.key === DEFAULT_AVATAR_KEY)!;
}

/**
 * Validate an avatar file before upload or URL import.
 * Returns null if valid, or a plain-English error string.
 */
export function validateAvatarFile(file: {
  sizebytes: number;
  mimetype: string;
  width: number;
  height: number;
}): string | null {
  const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/webp", "image/gif"];
  const MAX_BYTES = 512 * 1024; // 512 KB
  const ASPECT_TOLERANCE = 0.1;

  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return `Unsupported format "${file.mimetype}". Allowed: SVG, PNG, WebP, GIF.`;
  }
  if (file.sizebytes > MAX_BYTES) {
    return `File is ${Math.round(file.sizebytes / 1024)}KB — maximum is 512KB.`;
  }
  const ratio = file.width / file.height;
  if (Math.abs(ratio - 1) > ASPECT_TOLERANCE) {
    return `Image must be roughly square (${file.width}×${file.height} is too wide or tall).`;
  }
  return null;
}
