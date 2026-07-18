import { describe, expect, it } from "vitest";
import { classifyCallTrack, pickMainKind } from "./tracks";

describe("classifyCallTrack", () => {
  it("maps screen-share video to 'screen'", () => {
    expect(classifyCallTrack("screen_share", "video")).toBe("screen");
  });
  it("maps camera video to 'camera'", () => {
    expect(classifyCallTrack("camera", "video")).toBe("camera");
  });
  it("maps any audio to 'audio'", () => {
    expect(classifyCallTrack("microphone", "audio")).toBe("audio");
    expect(classifyCallTrack("screen_share_audio", "audio")).toBe("audio");
  });
  it("falls back to 'other' for unknown video sources", () => {
    expect(classifyCallTrack("unknown", "video")).toBe("other");
  });
});

describe("pickMainKind", () => {
  it("prefers screen when a screen share exists", () => {
    expect(pickMainKind(true)).toBe("screen");
  });
  it("defaults to camera otherwise", () => {
    expect(pickMainKind(false)).toBe("camera");
  });
});
