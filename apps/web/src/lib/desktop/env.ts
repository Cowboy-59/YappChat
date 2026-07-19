/**
 * Spec 089 — the renderer's view of the Electron bridge (preload contextBridge).
 * Present only inside the desktop app; null in a browser → agent-download path.
 */
export type DesktopBridge = {
  isDesktop: true;
  startControl(token: string, wsUrl: string): void;
  stopControl(): void;
};

export function getDesktopBridge(): DesktopBridge | null {
  const b = (globalThis as { yappchatDesktop?: DesktopBridge }).yappchatDesktop;
  return b?.isDesktop ? b : null;
}

export function isDesktop(): boolean {
  return getDesktopBridge() !== null;
}
