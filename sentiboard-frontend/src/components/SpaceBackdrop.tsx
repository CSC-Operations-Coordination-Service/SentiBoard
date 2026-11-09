"use client";

/* SpaceBackdrop — the star field and the curved edge of the Earth from SentiBoard.html, as one
 * React component.
 *
 * The HTML lays the planet out as ONE panorama three windows wide, in menu order, with the top of
 * the globe under the middle page. Each page draws only its own window of it, which is why the curve
 * leans differently on each page:
 *
 *   page -1  Acquisitions        the far left: the limb rises in from the right edge
 *   page  0  Events              left third: the planet climbs from left to right
 *   page  1  Data Availability   middle third: the top of the globe, almost flat
 *   page  2  Processors          right third: the planet falls away to the right
 *
 * `turn` rotates the globe (and the star field with it). The HTML ties it to what the page shows —
 * the month on Events, the window of days on Data Availability, the mission on Processors — and
 * eases to each new value in 900ms. Leave it out for a still planet.
 *
 * Usage: inside a section that is position: relative, as its first child.
 *   <section className={s.page}>
 *     <SpaceBackdrop page={1} turn={-firstDayIndex * 0.0025} />
 *     ...content (position: relative; z-index: 1)...
 *   </section>
 * and give the section a padding-bottom of at least --sb-earth-h, so content stops above the planet.
 */

import { useEffect, useRef } from "react";
import s from "./SpaceBackdrop.module.css";
import { asset } from "@/lib/asset";

/** The Earth-limb photo strip: 512px across the edge (space → ground), 1480px along it. */
const TEXTURE = asset("/assets/img/earth-limb.jpg");

/* Texture strip geometry: D0..D1 is space above the limb (negative) to deep inside the planet, L is
   the strip's length along the edge, ROT how many texture units one unit of `turn` moves. */
const D0 = -64;
const D1 = 448;
const L = 1480;
const ROT = 6335.53;

interface Geometry {
  W: number;
  H: number;
  /** planet height under the middle page */
  hc: number;
  /** globe radius, so that the planet drops to 40% of hc at the panorama's far ends */
  R: number;
  /** px per texture unit, inwards / along the edge */
  k: number;
  ka: number;
  /** canvas height */
  ch: number;
  /** this page's horizontal offset in the panorama, and the globe centre's y in the canvas */
  off: number;
  cy: number;
}

function geometry(page: number): Geometry {
  const W = document.documentElement.clientWidth || window.innerWidth;
  const H = window.innerHeight;
  const hc = Math.max(100, Math.min(190, H * 0.15));
  const he = hc * 0.4;
  const half = 1.5 * W;
  const drop = hc - he;
  const R = (half * half + drop * drop) / (2 * drop);
  const k = (hc * 1.02) / D1;
  const ka = half / L;
  const ch = Math.ceil(hc + -D0 * k + 6);
  return { W, H, hc, R, k, ka, ch, off: page * W - half, cy: ch - hc + R };
}

/* ------------------------------------------------------------------------------------------------
 * The planet: one full-screen triangle, and a fragment shader that works out, for every pixel, how
 * deep inside the globe it is and how far round — and reads the photo strip there. Above the limb
 * it fades to transparent over 64 texture units, which is the thin blue atmosphere.
 * ---------------------------------------------------------------------------------------------- */
const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = [
  "precision highp float;",
  "uniform sampler2D t;uniform float k,ka,ph,hh,off,cy,R;",
  `const float L=${L.toFixed(1)},D0=${D0.toFixed(1)},D1=${D1.toFixed(1)},ROT=${ROT.toFixed(2)};`,
  "void main(){",
  "  vec2 d=vec2(off+gl_FragCoord.x,(hh-gl_FragCoord.y)-cy);",
  "  float dep=(R-length(d))/k;",
  "  if(dep<D0){gl_FragColor=vec4(0.);return;}",
  "  float u=atan(d.x,-d.y)*R/ka+ph*ROT+L*.5;",
  "  float x=(clamp(dep,D0,D1-1.)-D0+.5)/(D1-D0);",
  "  float a=clamp((dep-D0)/(-D0),0.,1.);",
  // the strip repeats without a visible seam: two copies half a strip apart, blended near each wrap
  "  float f1=fract(u/L), f2=fract(u/L+.5);",
  "  float w=smoothstep(.62,1.,abs(2.*f1-1.));",
  "  vec3 c=mix(texture2D(t,vec2(x,f1)).rgb,texture2D(t,vec2(x,f2)).rgb,w);",
  "  gl_FragColor=vec4(c*a,a);",
  "}",
].join("\n");

interface Renderer {
  resize: (w: number, h: number) => void;
  draw: (g: Geometry, phi: number) => void;
  dpr: number;
  dispose: () => void;
}

function createRenderer(
  cvs: HTMLCanvasElement,
  onReady: () => void,
): Renderer | null {
  const gl = cvs.getContext("webgl", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
  });
  const hp = gl?.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  if (!gl || !hp || hp.precision <= 0) return null; // no WebGL: no planet, the sky still shows

  const shader = (type: number, src: string) => {
    const o = gl.createShader(type)!;
    gl.shaderSource(o, src);
    gl.compileShader(o);
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U: Record<string, WebGLUniformLocation | null> = {};
  ["k", "ka", "ph", "hh", "off", "cy", "R"].forEach(
    (n) => (U[n] = gl.getUniformLocation(pr, n)),
  );

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let ready = false;
  const tex = new Image();
  // A missing texture (wrong path, or a dev server answering with index.html) must not leave an
  // empty box: hide the planet and say why.
  tex.onerror = () => {
    console.warn(
      `SpaceBackdrop: could not load ${TEXTURE} — put earth-limb.jpg in /public${TEXTURE.replace(/\/[^/]+$/, "/")}`,
    );
    cvs.style.display = "none";
  };
  tex.onload = () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tex);
    ready = true;
    onReady();
  };
  tex.src = TEXTURE;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return {
    dpr,
    resize(w, h) {
      cvs.width = w;
      cvs.height = h;
      gl.viewport(0, 0, w, h);
    },
    draw(g, phi) {
      if (!ready) return;
      gl.uniform1f(U.k, g.k * dpr);
      gl.uniform1f(U.ka, g.ka * dpr);
      gl.uniform1f(U.ph, phi);
      gl.uniform1f(U.hh, cvs.height);
      gl.uniform1f(U.off, g.off * dpr);
      gl.uniform1f(U.cy, g.cy * dpr);
      gl.uniform1f(U.R, g.R * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      tex.onload = null;
      tex.onerror = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/* ------------------------------------------------------------------------------------------------
 * The sky: one seeded star field, a strip three windows wide (plus a copy of its first window so it
 * wraps without a seam). Each page shows its own third, and the strip moves with the globe's turn,
 * so sky and planet travel together. Same seed, density and sizes as the HTML.
 * ---------------------------------------------------------------------------------------------- */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skySvg(W: number, H: number): string {
  const px = W <= 900 ? W - 36 : 0.98 * W - 334;
  const sp = Math.max(0.2, px / 1580); // star size follows the window, as on Events
  const T = 3 * W;
  const starD = 1901 / (2860 * 2080) / (sp * sp);
  const glowD = 66 / (2860 * 2080) / (sp * sp);
  const out: string[] = [];
  const wrap: string[] = [];

  const r = rng(20260923);
  const n = Math.round(T * H * starD);
  for (let i = 0; i < n; i++) {
    const x = r() * T;
    const y = r() * H;
    const fr = ((1.7 + r() * 0.7) * sp).toFixed(2);
    const tail =
      r() < 0.45
        ? ` cy="${y.toFixed(1)}" r="${fr}" fill="#DCE8F2" class="sb-tw" style="animation-duration:${(3 + r() * 4).toFixed(1)}s;animation-delay:-${(r() * 5).toFixed(1)}s"/>`
        : ` cy="${y.toFixed(1)}" r="${fr}" fill="#DCE8F2" opacity="${(0.05 + r() * 0.13).toFixed(2)}"/>`;
    out.push(`<circle cx="${x.toFixed(1)}"${tail}`);
    if (x < W + 12) wrap.push(`<circle cx="${(x + T).toFixed(1)}"${tail}`);
  }

  const r2 = rng(20260923 + 313);
  const g = Math.round(T * H * glowD);
  for (let k = 0; k < g; k++) {
    const gx = r2() * T;
    const gy = r2() * H;
    const css = ` style="animation-duration:${(5.5 + r2() * 6).toFixed(1)}s;animation-delay:${(-r2() * 11).toFixed(1)}s"`;
    const rg = ((3 + r2() * 3) * sp).toFixed(1);
    const rc = ((0.79 + r2() * 0.65) * sp).toFixed(2);
    const one = (xx: number) =>
      `<circle class="sb-glow" cx="${xx.toFixed(1)}" cy="${gy.toFixed(1)}" r="${rg}" fill="#BFE6F2"${css}/>` +
      `<circle class="sb-shine" cx="${xx.toFixed(1)}" cy="${gy.toFixed(1)}" r="${rc}" fill="#F2F8FF"${css}/>`;
    out.push(one(gx));
    if (gx < W + 12) wrap.push(one(gx + T));
  }

  // two satellites crossing the whole strip, timed by the clock so every page shows the same one
  const now = Date.now() / 1000;
  const dA = 120;
  const dB = 170;
  const kf =
    `@keyframes sbSatA{0%{transform:translate(-80px,${(0.2 * H).toFixed(0)}px);opacity:0}2%{opacity:.8}62%{opacity:.8}` +
    `64%{transform:translate(${T + 80}px,${(0.33 * H).toFixed(0)}px);opacity:0}100%{transform:translate(${T + 80}px,${(0.33 * H).toFixed(0)}px);opacity:0}}` +
    `@keyframes sbSatB{0%{transform:translate(${T + 80}px,${(0.64 * H).toFixed(0)}px);opacity:0}3%{opacity:.55}55%{opacity:.55}` +
    `58%{transform:translate(-80px,${(0.5 * H).toFixed(0)}px);opacity:0}100%{transform:translate(-80px,${(0.5 * H).toFixed(0)}px);opacity:0}}`;
  const sat = (dx: number) =>
    `<g transform="translate(${dx} 0)">` +
    `<g style="animation:sbSatA ${dA}s linear infinite;animation-delay:-${(now % dA).toFixed(2)}s"><circle r="${(1.5 * sp + 0.4).toFixed(2)}" fill="#DCE8F2"/></g>` +
    `<g style="animation:sbSatB ${dB}s linear infinite;animation-delay:-${(now % dB).toFixed(2)}s"><circle r="${(1.1 * sp + 0.3).toFixed(2)}" fill="#DCE8F2"/></g></g>`;

  const strip = 4 * W;
  return (
    `<svg width="${strip}" height="${H}" viewBox="0 0 ${strip} ${H}" aria-hidden="true">` +
    `<style>${kf}</style>${out.join("")}${wrap.join("")}${sat(0)}${sat(T)}</svg>`
  );
}

/* ------------------------------------------------------------------------------------------------ */

export interface SpaceBackdropProps {
  /** Which window of the panorama this page shows: -1 Acquisitions, 0 Events, 1 Data Availability,
   *  2 Processors. */
  page: -1 | 0 | 1 | 2;
  /** Rotation of the globe and the sky. Changes ease over 900ms. */
  turn?: number;
  /** Draw the star field too (set false to keep your own sky and add only the planet). */
  sky?: boolean;
  /** Freeze the twinkle and satellites (your page's motion toggle). */
  paused?: boolean;
}

export default function SpaceBackdrop({
  page,
  turn = 0,
  sky = true,
  paused = false,
}: SpaceBackdropProps) {
  const earthRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const phi = useRef(turn);
  const redrawRef = useRef<() => void>(() => {});

  // Planet + sky: built once per page, rebuilt on resize.
  useEffect(() => {
    const host = earthRef.current;
    if (!host) return;
    // A fresh canvas on every run. In development React StrictMode runs this effect twice; the first
    // cleanup loses its WebGL context, and a canvas whose context was lost can never get a working
    // one back — it shows as a white box with a broken-image icon. A new canvas each time avoids that.
    const cvs = document.createElement("canvas");
    host.appendChild(cvs);
    let g = geometry(page);
    let skyKey = "";

    const shiftSky = () => {
      const svg = skyRef.current?.firstElementChild as SVGElement | null;
      if (!svg) return;
      const T = 3 * g.W;
      let x0 = (page * g.W + phi.current * ROT * g.ka) % T;
      if (x0 < 0) x0 += T;
      svg.style.transform = `translate3d(${(-x0).toFixed(1)}px,0,0)`;
    };
    const buildSky = () => {
      if (!skyRef.current) return;
      const key = `${g.W}x${g.H}`;
      if (key !== skyKey) {
        skyKey = key;
        skyRef.current.innerHTML = skySvg(g.W, g.H);
      }
      shiftSky();
    };

    const renderer = createRenderer(cvs, () => redraw());
    const redraw = () => {
      renderer?.draw(g, phi.current);
      shiftSky();
    };
    const size = () => {
      g = geometry(page);
      host.style.height = `${g.ch}px`;
      // lets the page reserve room for the planet: padding-bottom: var(--sb-earth-h)
      // (set on the section: the wrapper's parent)
      host.parentElement?.parentElement?.style.setProperty(
        "--sb-earth-h",
        `${g.ch}px`,
      );
      renderer?.resize(
        Math.round(g.W * renderer.dpr),
        Math.round(g.ch * renderer.dpr),
      );
      buildSky();
      redraw();
    };
    redrawRef.current = redraw;

    size();
    window.addEventListener("resize", size);
    return () => {
      window.removeEventListener("resize", size);
      redrawRef.current = () => {};
      renderer?.dispose();
      cvs.remove();
    };
  }, [page, sky]);

  // Turn: ease from wherever the globe is to the new value, 900ms ease-out cubic.
  useEffect(() => {
    const from = phi.current;
    if (from === turn) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      phi.current = turn;
      redrawRef.current();
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const q = Math.min(1, (now - t0) / 900);
      const e = 1 - Math.pow(1 - q, 3);
      phi.current = from + (turn - from) * e;
      redrawRef.current();
      if (q < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [turn]);

  // ONE wrapper, absolutely positioned over the whole section. Rules such as
  // `.page > * { position: relative }` (yours, or the ambient-motion styles) would otherwise catch
  // the planet itself, pull it out of position: absolute and drop it into the flow at the TOP of the
  // section. The wrapper's position is forced in CSS, so those rules cannot move it.
  return (
    <div className={`${s.root} ${paused ? s.paused : ""}`} aria-hidden="true">
      {sky && (
        <div className={s.skyHost}>
          <div ref={skyRef} className={s.sky} />
        </div>
      )}
      {/* the canvas is added inside this div by the effect above */}
      <div ref={earthRef} className={s.earth} />
    </div>
  );
}
