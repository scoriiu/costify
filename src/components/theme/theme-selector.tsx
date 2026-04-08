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
      html.style.setProperty("--surface-0", "#F8FAFC");
      html.style.setProperty("--surface-1", "#FFFFFF");
      html.style.setProperty("--surface-2", "#F1F5F9");
      html.style.setProperty("--surface-3", "#E2E8F0");
      html.style.setProperty("--text-primary", "#0F172A");
      html.style.setProperty("--text-secondary", "#334155");
      html.style.setProperty("--text-muted", "#64748B");
    } else {
      html.classList.remove("light");
      html.style.removeProperty("--surface-0");
      html.style.removeProperty("--surface-1");
      html.style.removeProperty("--surface-2");
      html.style.removeProperty("--surface-3");
      html.style.removeProperty("--text-primary");
      html.style.removeProperty("--text-secondary");
      html.style.removeProperty("--text-muted");
    }
    localStorage.setItem("costify-theme", light ? "light" : "dark");
  }, [light]);

  return (
    <div
      onClick={flip}
      role="button"
      tabIndex={0}
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        backgroundColor: light ? "#E2E8F0" : "#21262D",
        border: `1px solid ${light ? "#CBD5E1" : "#30363D"}`,
        padding: 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        transition: "background-color 0.2s",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: light ? "#FFFFFF" : "#161B22",
          color: light ? "#0F172A" : "#F0F6FC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: light ? "translateX(22px)" : "translateX(0)",
          transition: "transform 0.2s, background-color 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      >
        {light ? <Sun size={13} /> : <Moon size={13} />}
      </div>
    </div>
  );
}
