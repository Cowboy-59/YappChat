import { Button, Key, Point, keyboard, mouse } from "@nut-tree-fork/nut-js";

export const KEY = {
  Enter: Key.Enter, Backspace: Key.Backspace, Tab: Key.Tab, Escape: Key.Escape,
  " ": Key.Space, ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
  Delete: Key.Delete, Home: Key.Home, End: Key.End, PageUp: Key.PageUp, PageDown: Key.PageDown,
  Shift: Key.LeftShift, Control: Key.LeftControl, Alt: Key.LeftAlt, Meta: Key.LeftSuper,
  CapsLock: Key.CapsLock, Insert: Key.Insert,
};
for (let i = 1; i <= 12; i++) KEY[`F${i}`] = Key[`F${i}`];

export const btn = (b) => (b === "right" ? Button.RIGHT : b === "middle" ? Button.MIDDLE : Button.LEFT);
export const mapKey = (key) => KEY[key];
export const toPixels = (norm, extent) => Math.round(norm * extent);

mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

/**
 * Spec 089 — the injector shared by the standalone agent and the Electron main
 * process. `getScreen()` returns the target display size {w,h}; inject() applies
 * one ControlInput. Pause state gates injection (host-local-input-wins).
 */
export function createInjector({ getScreen, onError }) {
  let paused = false;
  let lastInjectAt = 0;
  async function inject(input) {
    if (paused) return;
    lastInjectAt = Date.now();
    const { w, h } = getScreen();
    try {
      switch (input.t) {
        case "move":
          await mouse.setPosition(new Point(toPixels(input.x, w), toPixels(input.y, h)));
          break;
        case "down":
          await mouse.setPosition(new Point(toPixels(input.x, w), toPixels(input.y, h)));
          await mouse.pressButton(btn(input.button));
          break;
        case "up":
          await mouse.releaseButton(btn(input.button));
          break;
        case "scroll":
          if (input.dy < 0) await mouse.scrollUp(Math.max(1, Math.round(-input.dy / 40)));
          else if (input.dy > 0) await mouse.scrollDown(Math.max(1, Math.round(input.dy / 40)));
          if (input.dx < 0) await mouse.scrollLeft(Math.max(1, Math.round(-input.dx / 40)));
          else if (input.dx > 0) await mouse.scrollRight(Math.max(1, Math.round(input.dx / 40)));
          break;
        case "key": {
          const mapped = mapKey(input.key);
          if (mapped !== undefined) {
            if (input.down) await keyboard.pressKey(mapped);
            else await keyboard.releaseKey(mapped);
          } else if (input.down && input.key.length === 1) {
            await keyboard.type(input.key);
          }
          break;
        }
        case "text":
          await keyboard.type(input.text);
          break;
        default:
          break;
      }
    } catch (err) {
      if (onError) onError(err);
    }
  }
  return {
    inject,
    setPaused: (p) => { paused = p; },
    isPaused: () => paused,
    lastInjectAt: () => lastInjectAt,
  };
}
