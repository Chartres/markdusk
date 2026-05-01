import "./smoke.css";

export type Appearance = "system" | "light" | "dark";

export function applyAppearance(mode: Appearance): void {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-appearance");
  } else {
    document.documentElement.setAttribute("data-appearance", mode);
  }
}
