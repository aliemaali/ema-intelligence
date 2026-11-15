"use client";
import { useEffect, useState } from "react";

const berlinHour = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23",
});

export function MailGreeting({ firstName }: { firstName?: string }) {
  const [greeting, setGreeting] = useState("Hallo");
  useEffect(() => {
    const update = () => {
      const hour = Number(berlinHour.format(new Date()));
      setGreeting(hour >= 5 && hour < 11 ? "Guten Morgen" : hour >= 18 || hour < 5 ? "Guten Abend" : "Hallo");
    };
    update();
    const timer = window.setInterval(update, 60000);
    const onVisible = () => { if (!document.hidden) update(); };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return <h1>{greeting}{firstName ? `${greeting === "Hallo" ? " " : ", "}${firstName}` : ""}</h1>;
}
