import { describe, expect, it } from "vitest";
import { ACTIVE_STATUSES, END_EVENT, canTransition, isActive, nextStatus } from "./state";
import type { RemoteControlStatus } from "../db/remotecontrol-schema";

const ALL: RemoteControlStatus[] = ["requested", "agent_pending", "granted", "paused", "ended"];

describe("remote-control state machine — legal transitions only", () => {
  it("allow: only from requested → agent_pending", () => {
    expect(nextStatus("requested", "allow")).toBe("agent_pending");
    for (const s of ALL.filter((s) => s !== "requested")) expect(nextStatus(s, "allow")).toBeNull();
  });

  it("decline: only from requested → ended", () => {
    expect(nextStatus("requested", "decline")).toBe("ended");
    for (const s of ALL.filter((s) => s !== "requested")) expect(nextStatus(s, "decline")).toBeNull();
  });

  it("register (agent auth): only from agent_pending → granted", () => {
    expect(nextStatus("agent_pending", "register")).toBe("granted");
    for (const s of ALL.filter((s) => s !== "agent_pending")) expect(nextStatus(s, "register")).toBeNull();
  });

  it("pause/resume: only between granted and paused", () => {
    expect(nextStatus("granted", "pause")).toBe("paused");
    expect(nextStatus("paused", "resume")).toBe("granted");
    expect(nextStatus("paused", "pause")).toBeNull();
    expect(nextStatus("granted", "resume")).toBeNull();
  });

  it("end: legal from every active status, no-op once ended (fail-closed kill)", () => {
    for (const s of ACTIVE_STATUSES) expect(nextStatus(s, "end")).toBe("ended");
    expect(nextStatus("ended", "end")).toBeNull();
  });

  it("cannot skip consent: a raw requested session can never jump straight to granted", () => {
    expect(nextStatus("requested", "register")).toBeNull(); // must pass through allow (agent_pending) first
  });

  it("ended is terminal for every action", () => {
    for (const a of ["allow", "decline", "register", "pause", "resume", "end"] as const) {
      expect(nextStatus("ended", a)).toBeNull();
    }
  });
});

describe("helpers", () => {
  it("isActive is false only for ended", () => {
    for (const s of ACTIVE_STATUSES) expect(isActive(s)).toBe(true);
    expect(isActive("ended")).toBe(false);
  });

  it("canTransition mirrors nextStatus", () => {
    expect(canTransition("requested", "allow")).toBe(true);
    expect(canTransition("granted", "allow")).toBe(false);
  });

  it("END_EVENT maps every end reason to a distinct audit event", () => {
    expect(END_EVENT.stopped).toBe("stopped");
    expect(END_EVENT.panic).toBe("panic");
    expect(END_EVENT.declined).toBe("declined");
    expect(END_EVENT.disconnected).toBe("disconnected");
  });
});
