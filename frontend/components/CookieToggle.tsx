"use client";
import { useEffect } from "react";

// Wires the opt-in/out control that is injected as static HTML in the Cookie Notice body.
export default function CookieToggle() {
  useEffect(() => {
    const s = document.getElementById("cookie-status");
    const a = document.getElementById("cookie-accept");
    const r = document.getElementById("cookie-refuse");
    if (!s || !a || !r) return;
    const set = (inOpt: boolean) => {
      s.className = "status" + (inOpt ? "" : " off");
      s.innerHTML = "Your current status: <b>" + (inOpt ? "Opted in" : "Opted out") + "</b>";
    };
    const onA = () => set(true);
    const onR = () => set(false);
    a.addEventListener("click", onA);
    r.addEventListener("click", onR);
    return () => { a.removeEventListener("click", onA); r.removeEventListener("click", onR); };
  }, []);
  return null;
}
