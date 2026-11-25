"use client";

/* News bar: fixed strip with a scrolling ticker and an expandable list.
   Prototype ref §§2–3; decisions 3–7 in home-prototype-ref.md §11.
   Hidden when items is empty.
   List is hidden with CSS visibility (class .listOpen), never inert. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { InstantMessage } from "./adapter";
import NewsCard from "@/features/news/NewsCard";
import s from "./home.module.css";

interface Props {
  items: InstantMessage[];
}

export default function NewsBar({ items }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const raf1Ref = useRef<number>(0);
  const raf2Ref = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setNews = useCallback((open: boolean) => {
    const el = listRef.current;
    if (!el) return;

    isOpenRef.current = open;
    setIsOpen(open);

    cancelAnimationFrame(raf1Ref.current);
    cancelAnimationFrame(raf2Ref.current);
    clearTimeout(timerRef.current);
    cleanupRef.current?.();
    cleanupRef.current = null;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (open) {
      el.style.cssText = "height:0px;opacity:0;overflow:hidden;transition:none";
      if (prefersReduced) {
        const natural = el.scrollHeight;
        const max = window.innerHeight - 140;
        if (natural > max) {
          el.style.height = `${max}px`;
          el.style.overflowY = "auto";
        } else {
          el.style.height = "auto";
          el.style.overflow = "visible";
        }
        el.style.opacity = "1";
      } else {
        raf1Ref.current = requestAnimationFrame(() => {
          raf2Ref.current = requestAnimationFrame(() => {
            if (!isOpenRef.current) return;
            const natural = el.scrollHeight;
            const max = window.innerHeight - 140;
            const h = Math.min(natural, max);
            el.style.overflowY = natural > max ? "auto" : "hidden";
            el.style.transition =
              "height 520ms cubic-bezier(.2,.7,.2,1),opacity 360ms ease";
            el.style.height = `${h}px`;
            el.style.opacity = "1";
            // Once the height animation ends, switch to auto so <details> cards can grow
            const onDone = (evt: TransitionEvent) => {
              if (evt.propertyName !== "height") return;
              el.removeEventListener("transitionend", onDone);
              cleanupRef.current = null;
              if (!isOpenRef.current) return;
              el.style.height = "auto";
              el.style.overflow = "visible";
              el.style.overflowY = "";
              el.style.transition = "";
            };
            cleanupRef.current = () => el.removeEventListener("transitionend", onDone);
            el.addEventListener("transitionend", onDone);
          });
        });
      }
    } else {
      if (prefersReduced) {
        el.style.cssText = "";
        el.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(d => { d.open = false; });
      } else {
        const h = el.offsetHeight;
        el.style.cssText = `height:${h}px;opacity:1;overflow:hidden;transition:none`;
        raf1Ref.current = requestAnimationFrame(() => {
          el.style.transition =
            "height 520ms cubic-bezier(.2,.7,.2,1),opacity 360ms ease";
          el.style.height = "0px";
          el.style.opacity = "0";
          timerRef.current = setTimeout(() => {
            if (!isOpenRef.current) {
              el.style.cssText = "";
              el.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(d => { d.open = false; });
            }
          }, 540);
        });
      }
    }
  }, []);

  /* Escape closes the list and returns focus to the button. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNews(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setNews]);

  /* Cleanup on unmount. */
  useEffect(() => {
    return () => {
      cancelAnimationFrame(raf1Ref.current);
      cancelAnimationFrame(raf2Ref.current);
      clearTimeout(timerRef.current);
      cleanupRef.current?.();
    };
  }, []);

  if (items.length === 0) return null;

  /* Ticker: items duplicated for a seamless −50% translateX loop. */
  const live = [...items, ...items];

  return (
    <div className={s.bar}>
      <div className={s.row}>
        <button
          ref={btnRef}
          type="button"
          className={s.news}
          aria-expanded={isOpen}
          aria-controls="news-list"
          onClick={() => setNews(!isOpenRef.current)}
        >
          <i className={s.dot} />
          News
          <span className={s.count}>{items.length}</span>
          <svg
            className={isOpen ? `${s.chevron} ${s.chevronOpen}` : s.chevron}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>

        <div className={s.mask}>
          <div
            className={s.track}
            style={{ "--ticker-dur": `${13.6 * items.length}s` } as React.CSSProperties}
          >
            {live.map((e, i) => (
              <span key={i} className={s.item}>
                <span>{e.title}</span>
                <span className={s.sep} />
                <time className={s.time}>{e.date} {e.time}</time>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={listRef}
        id="news-list"
        className={isOpen ? `${s.list} ${s.listOpen}` : s.list}
        aria-hidden={!isOpen}
      >
        {items.map((item, k) => (
          <div
            key={item.id}
            className={s.newsRow}
            style={{ "--k": k } as React.CSSProperties}
          >
            <NewsCard item={item} group="home-news" />
          </div>
        ))}
      </div>
    </div>
  );
}
