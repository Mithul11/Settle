// Theme preference: a cookie so the server renders the right data-theme on
// <html> and there is no flash. Dark is the default.
export const THEME_COOKIE = "settle_theme";
export type Theme = "dark" | "light";

export function parseTheme(value: unknown): Theme {
  return value === "light" ? "light" : "dark";
}
