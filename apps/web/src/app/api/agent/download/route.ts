export const dynamic = "force-dynamic";

/**
 * Spec 088 FR-006 — GET /api/agent/download?token=…
 *
 * Serves a tiny token-stamped Windows launcher (`yappchat-control.cmd`) that
 * starts the helper agent bound to this one control session. The token is the
 * credential (single-use, short-TTL, minted at "Allow control"); the agent
 * authenticates outbound with it and self-terminates when the session ends.
 *
 * NOTE (v1): this hands out a launcher for the globally-installed agent (see
 * apps/agent/README.md — `npm install -g`). Productionization = serving a
 * code-signed `yappchat-agent.exe` from storage instead of a .cmd.
 */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  // Opaque base64url token (generateToken → 32 bytes). Reject anything else.
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) {
    return new Response("invalid or missing token", { status: 400 });
  }
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "wss://ws.wxperts.com";

  const cmd =
    "@echo off\r\n" +
    "title YappChat Remote Control - keep this window open\r\n" +
    "echo Starting the YappChat control helper. Close this window (or press Esc twice) to STOP.\r\n" +
    `set "YAPPCHAT_WS_URL=${wsUrl}"\r\n` +
    `set "YAPPCHAT_CONTROL_TOKEN=${token}"\r\n` +
    "yappchat-control-agent\r\n" +
    "echo.\r\n" +
    "echo Control session ended.\r\n" +
    "pause\r\n";

  return new Response(cmd, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": 'attachment; filename="yappchat-control.cmd"',
      "cache-control": "no-store",
    },
  });
}
