/**
 * Spec 003 (T007) — capacity alert state machine (pure, unit-tested).
 *
 * Tracks the 70% and 90% thresholds independently. Each fires at most once per
 * crossing and only RE-ARMS after connections fall below 60% — so a sustained
 * high load doesn't spam alerts. Kept side-effect-free so the engine can own the
 * actual delivery + timestamps.
 */
export type CapacityState = {
  armed70: boolean;
  armed90: boolean;
  triggered70: boolean;
  triggered90: boolean;
};

export const initialCapacityState = (): CapacityState => ({
  armed70: true,
  armed90: true,
  triggered70: false,
  triggered90: false,
});

export type CapacityDecision = { state: CapacityState; fire: 70 | 90 | null };

/** Given the current utilization %, return the next state and which alert (if any) to fire. */
export function evaluateCapacity(pct: number, prev: CapacityState): CapacityDecision {
  const state: CapacityState = { ...prev };

  // Re-arm once we drop comfortably below the warning line.
  if (pct < 60) {
    state.armed70 = true;
    state.armed90 = true;
    state.triggered70 = false;
    state.triggered90 = false;
    return { state, fire: null };
  }

  if (pct >= 90 && state.armed90) {
    state.armed90 = false;
    state.triggered90 = true;
    return { state, fire: 90 };
  }
  if (pct >= 70 && state.armed70) {
    state.armed70 = false;
    state.triggered70 = true;
    return { state, fire: 70 };
  }
  return { state, fire: null };
}
