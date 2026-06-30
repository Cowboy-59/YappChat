import { describe, expect, it } from "vitest";
import { evaluateCapacity, initialCapacityState } from "./capacity";

describe("evaluateCapacity (spec 003 T007)", () => {
  it("fires the 70% alert once when first crossing", () => {
    const s0 = initialCapacityState();
    const r1 = evaluateCapacity(72, s0);
    expect(r1.fire).toBe(70);
    expect(r1.state.triggered70).toBe(true);
    // Staying above 70% does not re-fire.
    const r2 = evaluateCapacity(75, r1.state);
    expect(r2.fire).toBeNull();
  });

  it("escalates to 90% independently of the 70% alert", () => {
    let s = initialCapacityState();
    s = evaluateCapacity(72, s).state; // fire 70
    const r = evaluateCapacity(91, s);
    expect(r.fire).toBe(90);
    expect(r.state.triggered90).toBe(true);
    // 90% won't re-fire while still armed-off.
    expect(evaluateCapacity(95, r.state).fire).toBeNull();
  });

  it("jumping straight past 90% fires 90 (not 70)", () => {
    expect(evaluateCapacity(93, initialCapacityState()).fire).toBe(90);
  });

  it("re-arms only after dropping below 60%, then fires again", () => {
    let s = initialCapacityState();
    s = evaluateCapacity(72, s).state; // fire 70
    expect(evaluateCapacity(65, s).fire).toBeNull(); // 60-70 band: no re-arm, no fire
    const dropped = evaluateCapacity(55, s); // below 60 → re-arm
    expect(dropped.fire).toBeNull();
    expect(dropped.state.armed70).toBe(true);
    expect(dropped.state.triggered70).toBe(false);
    // Crossing 70 again now fires.
    expect(evaluateCapacity(72, dropped.state).fire).toBe(70);
  });

  it("does nothing below threshold", () => {
    expect(evaluateCapacity(10, initialCapacityState()).fire).toBeNull();
  });
});
