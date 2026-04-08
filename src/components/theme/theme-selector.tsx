"use client";

import { useEffect, useReducer } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [light, flip] = useReducer((s: boolean) => !s, false);

  useEffect(() => {
    if (localStorage.getItem("costify-theme") === "light") flip();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (light) {
      html.classList.add("light");
    } else {
      html.classList.remove("light");
    }
    localStorage.setItem("costify-theme", light ? "light" : "dark");
  }, [light]);

  return (
    <button
      onClick={flip}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors cursor-pointer"
    >
      {light ? <Moon size={14} /> : <Sun size={14} />}
      {light ? "Dark mode" : "Light mode"}
    </button>
  );
}
