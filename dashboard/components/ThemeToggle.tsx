"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import Glyph from "./Glyph";

type Theme = "readout" | "night";

const KEY = "theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "readout";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const held = document.documentElement.dataset.theme;
    setTheme(held === "readout" || held === "night" ? held : systemTheme());
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    document.cookie = `${KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);

  const next = theme === "night" ? "readout" : "night";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="flex shrink-0 items-center rounded-field p-1.5 text-soft transition-colors
        hover:bg-base-200 hover:text-base-content"
    >
      <span className="sr-only">{next === "night" ? "Switch to dark theme" : "Switch to light theme"}</span>
      <Glyph icon={theme === "night" ? Sun : Moon} size={16} />
    </button>
  );
}
