import { describe, expect, it } from "vitest";
import {
  connectionFor,
  egressConfigured,
  livekitConfigured,
  roomName,
  roomNameToPresentationId,
  verifyWebhook,
} from "./livekit";

describe("livekit room naming", () => {
  it("round-trips a presentation id", () => {
    expect(roomName("abc-123")).toBe("presentation-abc-123");
    expect(roomNameToPresentationId("presentation-abc-123")).toBe("abc-123");
  });
  it("returns null for a non-presentation room", () => {
    expect(roomNameToPresentationId("some-other-room")).toBeNull();
  });
});

describe("livekit config gating (unconfigured in the test env)", () => {
  it("reports unconfigured without env", () => {
    expect(livekitConfigured()).toBe(false);
    expect(egressConfigured()).toBe(false);
  });

  it("connectionFor returns null when LiveKit is unconfigured", () => {
    expect(connectionFor("p1", { identity: "u1", name: "U", isHost: true })).toBeNull();
  });

  it("verifyWebhook accepts in dev (unconfigured) and the result is deterministic", () => {
    expect(verifyWebhook(null, "{}")).toBe(true);
    expect(verifyWebhook("anything", '{"event":"egress_ended"}')).toBe(true);
  });
});
