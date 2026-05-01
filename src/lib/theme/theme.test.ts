import { describe, it, expect } from "vitest";
import { applyAppearance } from "./theme";

describe("applyAppearance", () => {
  it("sets data-appearance to 'light' when explicitly light", () => {
    document.documentElement.removeAttribute("data-appearance");
    applyAppearance("light");
    expect(document.documentElement.getAttribute("data-appearance")).toBe("light");
  });

  it("sets data-appearance to 'dark' when explicitly dark", () => {
    applyAppearance("dark");
    expect(document.documentElement.getAttribute("data-appearance")).toBe("dark");
  });

  it("removes data-appearance when system", () => {
    document.documentElement.setAttribute("data-appearance", "dark");
    applyAppearance("system");
    expect(document.documentElement.hasAttribute("data-appearance")).toBe(false);
  });
});
