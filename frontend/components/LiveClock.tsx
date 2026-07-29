"use client";
import { useEffect, useState } from "react";

const p = (n: number) => (n < 10 ? "0" : "") + n;

export default function LiveClock() {
  const [t, setT] = useState("--:--:-- UTC");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setT(`${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="clock">{t}</span>;
}
