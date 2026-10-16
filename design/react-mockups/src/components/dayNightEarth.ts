/* The planet of SentiBoard.html#acquisitions for the Three.js globe: satellite imagery by day, city
 * lights in the Earth's shadow, a warm band along the terminator and a blue limb.
 *
 * It does not need ThreeEarth's source: it finds the Earth sphere inside the scene's "EarthGroup" and
 * swaps its material for a shader. Latitude/longitude are worked out from the sphere's own vertex
 * positions with the page's latLonToVector3() convention (longitude + 90°), so footprints, stations
 * and orbits drawn with that function sit exactly on the imagery, however the group is rotated.
 *
 * Textures: two 4096×2048 equirectangular JPEGs in /public/assets/img/ (taken from SentiBoard.html).
 */
import * as THREE from "three";

const TEX_DAY = "/assets/img/earth-day.jpg";
const TEX_NIGHT = "/assets/img/earth-night.jpg";

const VS = /* glsl */ `
varying vec3 vObj;     // position on the unit sphere, in the Earth's own frame
varying vec3 vNormalV; // normal in view space, for the limb
varying vec3 vViewDir;
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FS = /* glsl */ `
uniform sampler2D day;
uniform sampler2D night;
uniform vec3 sun; // unit vector to the Sun, in the Earth's own frame
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vec3 n = normalize(vObj);
  // the page's convention: x = cos(lat) sin(lon + 90°), y = sin(lat), z = cos(lat) cos(lon + 90°)
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.x, n.z) - 1.5707963;
  vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), 0.5 + lat / 3.1415927);
  float light = dot(n, sun);
  // the same colour recipe as SentiBoard.html
  vec3 d = texture2D(day, uv).rgb * 1.04, nt = texture2D(night, uv).rgb;
  float lum = dot(nt, vec3(0.3, 0.59, 0.11));
  vec3 nightc = nt * vec3(0.30, 0.40, 0.58) + vec3(1.0, 0.78, 0.45) * smoothstep(0.16, 0.55, lum) * 2.1;
  vec3 dayc = d * (0.80 + 0.25 * smoothstep(0.0, 0.5, light));
  float k = smoothstep(-0.10, 0.10, light);
  vec3 col = mix(nightc, dayc, k);
  col += vec3(0.9, 0.45, 0.2) * 0.10 * (1.0 - abs(k * 2.0 - 1.0)) * k; // warm terminator
  float cc = clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0);
  float lim = pow(1.0 - cc, 2.2);
  col = mix(col, vec3(0.42, 0.66, 1.0), lim * 0.45 * (0.35 + 0.65 * k)); // blue limb
  col *= 0.82 + 0.18 * cc;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Unit vector to the Sun for a UTC time, in the page's latLonToVector3() frame. */
function sunVector(ms: number): THREE.Vector3 {
  const d = new Date(ms);
  const dayOfYear =
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) /
    86_400_000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)); // solar declination
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lon = -(hours - 12) * 15; // sub-solar longitude
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

export interface DayNightEarth {
  /** Moves the terminator to a UTC time (ms). */
  setTime: (ms: number) => void;
  dispose: () => void;
}

export function applyDayNightEarth(scene: THREE.Scene, timeMs: number): DayNightEarth | null {
  const earth = findEarthMesh(scene);
  if (!earth) {
    console.warn("dayNightEarth: no Earth sphere found in EarthGroup");
    return null;
  }

  const loader = new THREE.TextureLoader();
  const prep = (t: THREE.Texture) => {
    t.colorSpace = THREE.NoColorSpace; // the recipe works on the raw JPEG values, as in the HTML
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      day: { value: prep(loader.load(TEX_DAY)) },
      night: { value: prep(loader.load(TEX_NIGHT)) },
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
      if (minute === lastMinute) return; // one update per simulated minute is plenty
      lastMinute = minute;
      (material.uniforms.sun.value as THREE.Vector3).copy(sunVector(ms));
    },
    dispose() {
      earth.material = previous;
      material.uniforms.day.value.dispose();
      material.uniforms.night.value.dispose();
      material.dispose();
    },
  };
}
