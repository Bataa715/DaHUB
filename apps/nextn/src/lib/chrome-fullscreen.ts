"use client";

import { useCallback, useEffect, useState } from "react";

export const CHROME_FS_KEY = "dahub-chrome-fullscreen";
export const CHROME_FS_EVENT = "dahub-chrome-fullscreen";

/** Legacy Alert Box key — migrated once into CHROME_FS_KEY */
const LEGACY_ALERTBOX_FS_KEY = "dahub-alertbox-fullscreen";

/**
 * true = DaHUB sidebar hidden (content fullscreen)
 * Default: false (sidebar visible). Alert Box previously defaulted to true;
 * legacy localStorage is migrated on first read.
 */
export function getChromeFullscreen(): boolean {
  if (typeof window === "undefined") return false;
  const cur = localStorage.getItem(CHROME_FS_KEY);
  if (cur === "1" || cur === "0") return cur === "1";
  const legacy = localStorage.getItem(LEGACY_ALERTBOX_FS_KEY);
  if (legacy === "1" || legacy === "0") {
    localStorage.setItem(CHROME_FS_KEY, legacy);
    return legacy === "1";
  }
  return false;
}

export function setChromeFullscreen(value: boolean) {
  localStorage.setItem(CHROME_FS_KEY, value ? "1" : "0");
  window.dispatchEvent(new Event(CHROME_FS_EVENT));
}

export function useChromeFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFullscreen(getChromeFullscreen());
    setMounted(true);
    const sync = () => setFullscreen(getChromeFullscreen());
    window.addEventListener(CHROME_FS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHROME_FS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    setChromeFullscreen(!getChromeFullscreen());
  }, []);

  return { fullscreen, toggle, mounted, setFullscreen: setChromeFullscreen };
}
