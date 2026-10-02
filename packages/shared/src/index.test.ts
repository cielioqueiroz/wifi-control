import { describe, expect, it } from "vitest";

import { isPrivateMacAddress } from "./index.js";

describe("isPrivateMacAddress", () => {
  it("detects locally administered MAC addresses", () => {
    expect(isPrivateMacAddress("EA-57-FD-A3-38-C8")).toBe(true);
  });

  it("does not mark globally administered MAC addresses as private", () => {
    expect(isPrivateMacAddress("00:11:22:33:44:55")).toBe(false);
  });
});
