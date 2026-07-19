import { afterEach, describe, expect, it } from "vitest";
import { getDesktopBridge, isDesktop } from "./env";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).yappchatDesktop;
});

describe("desktop env", () => {
  it("reports browser when no bridge is present", () => {
    expect(isDesktop()).toBe(false);
    expect(getDesktopBridge()).toBeNull();
  });
  it("detects the injected desktop bridge", () => {
    (globalThis as Record<string, unknown>).yappchatDesktop = {
      isDesktop: true, startControl() {}, stopControl() {},
    };
    expect(isDesktop()).toBe(true);
    expect(getDesktopBridge()?.isDesktop).toBe(true);
  });
});
