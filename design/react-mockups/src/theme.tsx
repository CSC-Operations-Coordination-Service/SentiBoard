import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";
interface Ctx { theme: Theme; toggle: () => void; }
const ThemeContext = createContext<Ctx>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark-only mode: ignore stored preference and always start dark.
  // To restore the toggle, reinstate the localStorage read in useState and the setItem in useEffect.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Clear any stored choice so an old "light" value cannot outlive this session.
    // Not writing back to localStorage while the toggle is hidden — nothing needs storing.
    try { localStorage.removeItem("sb-theme"); } catch {}
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
