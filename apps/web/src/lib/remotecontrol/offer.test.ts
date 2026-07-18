import { describe, expect, it } from "vitest";
import * as service from "./service";

describe("offerControl", () => {
  it("is exported as an async function taking (dmId, hostUserId)", () => {
    expect(typeof service.offerControl).toBe("function");
    expect(service.offerControl.length).toBe(2);
  });
});
