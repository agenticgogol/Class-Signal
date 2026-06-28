"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("classsignal-theme", next);
    setTheme(next);
  }
  return <button suppressHydrationWarning className="theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === "dark" ? "Light" : "Dark"}</span>
  </button>;
}
