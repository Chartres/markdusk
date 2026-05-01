import "katex/dist/katex.min.css";
import "./smoke.css";
import "./amber.css";

export type Appearance = "system" | "light" | "dark";
export type Theme = "smoke" | "amber";

export function applyAppearance(mode: Appearance): void {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-appearance");
  } else {
    document.documentElement.setAttribute("data-appearance", mode);
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}
