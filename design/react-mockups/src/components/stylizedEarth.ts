/* The stylised planet of SentiBoard_stylized_globe.html#acquisitions, for the Three.js globe: a deep
 * blue sea lit from the upper left, slate-blue land with a fine cyan coastline, a faint graticule,
 * a blue rim and the night side as two soft dark caps opposite the Sun.
 *
 * Same contract as dayNightEarth.ts (setTime / dispose), so a page can switch between the two. It
 * finds the Earth sphere inside "EarthGroup" and swaps its material for a shader. Latitude/longitude
 * come from the sphere's own vertex positions with the page's latLonToVector3() convention
 * (longitude + 90°), so footprints, stations and tracks sit exactly on the coastlines.
 *
 * The coastlines come from data/land.ts (Natural Earth 110m). They are painted ONCE into an
 * equirectangular mask — land in red, coastline in green, graticule in blue — and the shader turns
 * that mask into colour, so the reference's gradients follow the view as the globe turns.
 */
import * as THREE from "three";
import { LAND } from "@/data/land";

/* ---------- the mask: land / coastline / graticule, one per channel ---------- */
const MASK_W = 4096;
const MASK_H = 2048;

function paintMask(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = MASK_W;
  c.height = MASK_H;
  const ctx = c.getContext("2d")!;
  const x = (lon: number) => ((lon + 180) / 360) * MASK_W;
  const y = (lat: number) => ((90 - lat) / 180) * MASK_H;
  const ring = (r: number[][]) => {
    ctx.moveTo(x(r[0][0]), y(r[0][1]));
    for (let i = 1; i < r.length; i++) ctx.lineTo(x(r[i][0]), y(r[i][1]));
    ctx.closePath();
  };

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  ctx.globalCompositeOperation = "lighter"; // channels add up instead of covering each other

  // land: red. Antarctica's ring already runs along −90°, so it closes on the map's bottom edge.
  ctx.beginPath();
  LAND.forEach(ring);
  ctx.fillStyle = "#ff0000";
  ctx.fill("nonzero");

  // coastline: green. ~1.8 px here is about the reference's 0.7 px line at the default zoom.
  ctx.beginPath();
  LAND.forEach(ring);
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 1.8;
  ctx.lineJoin = "round";
  ctx.stroke();

  // graticule: blue, d3's default — every 10°, parallels to ±80°, meridians to ±80° (every 90° to
  // the poles)
  ctx.beginPath();
  for (let lat = -80; lat <= 80; lat += 10) {
    ctx.moveTo(0, y(lat));
    ctx.lineTo(MASK_W, y(lat));
  }
  for (let lon = -180; lon < 180; lon += 10) {
    const full = lon % 90 === 0;
    ctx.moveTo(x(lon), y(full ? 90 : 80));
    ctx.lineTo(x(lon), y(full ? -90 : -80));
  }
  ctx.strokeStyle = "#0000ff";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return c;
}

/* ---------- the shader ---------- */
const VS = /* glsl */ `
varying vec3 vObj;     // position on the unit sphere, in the Earth's own frame
varying vec3 vNormalV; // normal in view space
varying vec3 vViewDir; // towards the camera, view space
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FS = /* glsl */ `
uniform sampler2D mask;
uniform vec3 sun; // unit vector to the Sun, in the Earth's own frame
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewDir;

vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

void main() {
  vec3 n = normalize(vObj);
  // the page's convention: x = cos(lat) sin(lon + 90°), y = sin(lat), z = cos(lat) cos(lon + 90°)
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.x, n.z) - 1.5707963;
  vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), 0.5 + lat / 3.1415927);
  vec3 m = texture2D(mask, uv).rgb;

  // where this point sits on the disc as seen: r = 0 at the centre, 1 on the limb
  vec3 nv = normalize(vNormalV);
  float cc = clamp(dot(nv, normalize(vViewDir)), 0.0, 1.0);
  float r = sqrt(max(0.0, 1.0 - cc * cc));
  vec2 p = length(nv.xy) > 1e-5 ? normalize(nv.xy) * r : vec2(0.0);

  // the reference's two-circle radial gradient: inner circle r 0.1 at (-0.3, +0.35) of the disc,
  // outer circle r 1 at its centre. f = the gradient position through this point.
  vec2 h = vec2(-0.3, 0.35);
  vec2 a = p - h;
  float A = dot(h, h) - 0.81;
  float B = 2.0 * dot(a, h) - 0.18;
  float C = dot(a, a) - 0.01;
  float disc = sqrt(max(B * B - 4.0 * A * C, 0.0));
  float f = clamp(max((-B + disc) / (2.0 * A), (-B - disc) / (2.0 * A)), 0.0, 1.0);

  // sea: #12314f → #0a1f35 (70%) → #041020; land: #3a6284 → #1d3a57
  vec3 sea = f < 0.7
    ? mix(hex(18.0, 49.0, 79.0), hex(10.0, 31.0, 53.0), f / 0.7)
    : mix(hex(10.0, 31.0, 53.0), hex(4.0, 16.0, 32.0), (f - 0.7) / 0.3);
  vec3 land = mix(hex(58.0, 98.0, 132.0), hex(29.0, 58.0, 87.0), f);
  vec3 col = mix(sea, land, m.r);

  col = mix(col, vec3(1.0), m.b * 0.06);                       // graticule
  col = mix(col, hex(110.0, 220.0, 240.0), m.g * 0.55);        // coastline

  // rim, lit like the planet at the foot of the other pages: 0 → 28% blue over the outer 14%
  col = mix(col, hex(90.0, 170.0, 255.0), clamp((r - 0.86) / 0.14, 0.0, 1.0) * 0.28);

  // night: a 96° cap (22%) and an 88° cap (40%) round the anti-solar point, softened by a degree
  float d = degrees(acos(clamp(dot(n, -sun), -1.0, 1.0)));
  float outer = 0.22 * (1.0 - smoothstep(95.5, 96.5, d));
  float inner = 0.40 * (1.0 - smoothstep(87.5, 88.5, d));
  float night = 1.0 - (1.0 - outer) * (1.0 - inner);
  col = mix(col, hex(2.0, 5.0, 12.0), night);

  gl_FragColor = vec4(col, 1.0);
}`;

/** Unit vector to the Sun for a UTC time, in the page's latLonToVector3() frame. */
function sunVector(ms: number): THREE.Vector3 {
  const d = new Date(ms);
  const dayOfYear =
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) /
    86_400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lon = -(hours - 12) * 15;
  const la = THREE.MathUtils.degToRad(decl);
  const lo = THREE.MathUtils.degToRad(lon + 90);
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** The Earth sphere: the smallest roughly-unit mesh in EarthGroup (clouds and atmosphere are bigger). */
function findEarthMesh(scene: THREE.Scene): THREE.Mesh | null {
  const root = scene.getObjectByName("EarthGroup") ?? scene;
  let best: THREE.Mesh | null = null;
  let bestR = Infinity;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const r = (m.geometry.boundingSphere?.radius ?? 0) * Math.max(m.scale.x, m.scale.y, m.scale.z);
    if (r > 0.9 && r < 1.1 && r < bestR && m.geometry.attributes.position.count > 200) {
      best = m;
      bestR = r;
    }
  });
  return best;
}

export interface StylizedEarth {
  /** Moves the night side to a UTC time (ms). */
  setTime: (ms: number) => void;
  dispose: () => void;
}

export function applyStylizedEarth(scene: THREE.Scene, timeMs: number): StylizedEarth | null {
  const earth = findEarthMesh(scene);
  if (!earth) {
    console.warn("stylizedEarth: no Earth sphere found in EarthGroup");
    return null;
  }

  const tex = new THREE.CanvasTexture(paintMask());
  tex.colorSpace = THREE.NoColorSpace; // a mask, not a colour image
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      mask: { value: tex },
      sun: { value: sunVector(timeMs) },
    },
    vertexShader: VS,
    fragmentShader: FS,
  });

  const previous = earth.material;
  earth.material = material;
  let lastMinute = -1;

  return {
    setTime(ms) {
      const minute = Math.floor(ms / 60_000);
      if (minute === lastMinute) return;
      lastMinute = minute;
      (material.uniforms.sun.value as THREE.Vector3).copy(sunVector(ms));
    },
    dispose() {
      earth.material = previous;
      tex.dispose();
      material.dispose();
    },
  };
}
