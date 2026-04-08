"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function getIsLight() {
  return document.documentElement.classList.contains("light");
}

function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const light = useSyncExternalStore(subscribe, getIsLight, () => true);

  const toggle = useCallback(() => {
    const html = document.documentElement;
    const next = !html.classList.contains("light");
    if (next) {
      html.classList.add("light");
    } else {
      html.classList.remove("light");
    }
    localStorage.setItem("costify-theme", next ? "light" : "dark");
  }, []);

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors cursor-pointer"
    >
      {light ? <Moon size={14} /> : <Sun size={14} />}
      {light ? "Dark mode" : "Light mode"}
    </button>
  );
}
