"use client";
import { useEffect } from "react";

// Paint the Mail background before hydration; do not change the platform theme.
const init = `(function(){var t='light';try{if(localStorage.getItem('ema-mail-theme-v2')==='dark')t='dark'}catch(e){}document.documentElement.setAttribute('data-ema-mail-theme',t)})();`;
export function MailChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (theme: "light" | "dark") => {
      root.dataset.emaMailTheme = theme;
      window.dispatchEvent(new Event("ema:mail-chrome-change"));
    };
    const restorePreference = () => {
      let theme: "light" | "dark" = "light";
      try { if (localStorage.getItem("ema-mail-theme-v2") === "dark") theme = "dark"; } catch { /* Default Mail appearance. */ }
      apply(theme);
    };
    const changed = (event: Event) => {
      const theme = (event as CustomEvent).detail;
      if (theme === "light" || theme === "dark") apply(theme);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "ema-mail-theme-v2" || event.key === null) restorePreference();
    };
    restorePreference();
    window.addEventListener("ema:mail-theme-change", changed);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("ema:mail-theme-change", changed);
      window.removeEventListener("storage", storage);
      delete root.dataset.emaMailTheme;
      window.dispatchEvent(new Event("ema:mail-chrome-change"));
    };
  }, []);
  return <script dangerouslySetInnerHTML={{__html:init}} />;
}
