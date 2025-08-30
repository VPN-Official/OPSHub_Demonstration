import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
