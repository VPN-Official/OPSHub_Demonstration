import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// ---------------------------------
// 1. Types
// ---------------------------------

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  getColor: (semantic: SemanticColor) => string;
}

type SemanticColor = "success" | "error" | "warning" | "info" | "neutral";

// ---------------------------------
// 2. Semantic Color Palette
// ---------------------------------

// Tailwind semantic mapping
const lightColors: Record<SemanticColor, string> = {
  success: "text-green-600",
  error: "text-red-600",
  warning: "text-yellow-600",
  info: "text-blue-600",
  neutral: "text-gray-800",
};

const darkColors: Record<SemanticColor, string> = {
  success: "text-green-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
  neutral: "text-gray-200",
};

// ---------------------------------
// 3. Context
// ---------------------------------

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ---------------------------------
// 4. Provider
// ---------------------------------

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(
    (localStorage.getItem("theme") as ThemeMode) || "light"
  );

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(mode);
    localStorage.setItem("theme", mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const getColor = (semantic: SemanticColor) => {
    return mode === "light" ? lightColors[semantic] : darkColors[semantic];
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, getColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks
// ---------------------------------

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

export const useSemanticColor = (semantic: SemanticColor) => {
  const { getColor } = useTheme();
  return getColor(semantic);
};