/* The planet of SentiBoard.html#acquisitions: satellite imagery by day, city lights in the Earth's
 * shadow, a warm band along the terminator and a blue limb — drawn by one WebGL fragment shader into
 * an offscreen canvas, which the 2D globe then blits as its base layer.
 *
 * The shader inverts the SAME projection AcquisitionGlobeEarth uses (yaw around the vertical axis,
 * then tilt), so footprints, orbits and stations drawn on top line up with the imagery exactly.
 *
 * Textures: two 4096×2048 equirectangular JPEGs in /public/assets/img/ (taken from SentiBoard.html).
 */

const TEX_DAY = "/assets/img/earth-day.jpg";
const TEX_NIGHT = "/assets/img/earth-night.jpg";

const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = [
  "precision highp float;",
  "uniform sampler2D day;uniform sampler2D night;",
  "uniform vec2 res;uniform vec2 ctr;uniform float R;",
  "uniform vec4 view;", // cos(yaw), sin(yaw), cos(tilt), sin(tilt)
  "uniform vec3 sun;", //  unit vector to the Sun, in the globe's own frame
  "void main(){",
  "  float u=(gl_FragCoord.x-ctr.x)/R;",
  "  float v=-((res.y-gl_FragCoord.y)-ctr.y)/R;",
  "  float q=u*u+v*v; if(q>1.0){gl_FragColor=vec4(0.);return;}",
  "  float w=sqrt(1.0-q);", // = cos of the angle from the disc centre
  // screen → globe: the inverse of AcquisitionGlobeEarth's projVec()
  "  float vy=v*view.z+w*view.w;",
  "  float z1=-v*view.w+w*view.z;",
  "  float vx=u*view.x+z1*view.y;",
  "  float vz=-u*view.y+z1*view.x;",
  "  vec3 n=vec3(vx,vy,vz);",
  "  float lat=asin(clamp(vy,-1.0,1.0)), lon=atan(vx,vz);",
  "  vec2 uv=vec2(fract(lon/6.2831853+0.5), 0.5-lat/3.1415927);",
  "  float light=dot(n,sun);",
  // the same colour recipe as SentiBoard.html
  "  vec3 d=texture2D(day,uv).rgb*1.04, nt=texture2D(night,uv).rgb;",
  "  float lum=dot(nt,vec3(0.3,0.59,0.11));",
  "  vec3 nightc=nt*vec3(0.30,0.40,0.58)+vec3(1.0,0.78,0.45)*smoothstep(0.16,0.55,lum)*2.1;",
  "  vec3 dayc=d*(0.80+0.25*smoothstep(0.0,0.5,light));",
  "  float k=smoothstep(-0.10,0.10,light);",
  "  vec3 col=mix(nightc,dayc,k);",
  "  col+=vec3(0.9,0.45,0.2)*0.10*(1.0-abs(k*2.0-1.0))*k;", // warm terminator
  "  float lim=pow(1.0-w,2.2);",
  "  col=mix(col,vec3(0.42,0.66,1.0),lim*0.45*(0.35+0.65*k));", // blue limb
  "  col*=0.82+0.18*w;",
  "  gl_FragColor=vec4(col,1.0);",
  "}",
].join("\n");

export interface GlobeTexture {
  /** true once both images are on the GPU */
  ready: () => boolean;
  /** Draws the planet into the offscreen canvas and returns it (device pixels). */
  render: (o: {
    width: number; // device px
    height: number;
    cx: number; // css px
    cy: number;
    R: number;
    dpr: number;
    yaw: number;
    tilt: number;
    simMs: number;
  }) => HTMLCanvasElement | null;
  dispose: () => void;
}

/** Unit vector to the Sun in the globe frame, for a UTC time. Same axes as unitVec(lat, lon). */
function sunVector(ms: number): [number, number, number] {
  const d = new Date(ms);
  const dayOfYear =
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), 0, 0)) /
    86_400_000;
  // solar declination (good to ~0.5°, plenty for a terminator)
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lon = -(hours - 12) * 15; // the sub-solar longitude
  const la = (decl * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

export function createGlobeTexture(onReady: () => void): GlobeTexture | null {
  const cvs = document.createElement("canvas");
  const gl = cvs.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
  if (!gl) return null;

  const sh = (type: number, src: string) => {
    const o = gl.createShader(type)!;
    gl.shaderSource(o, src);
    gl.compileShader(o);
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U: Record<string, WebGLUniformLocation | null> = {};
  ["day", "night", "res", "ctr", "R", "view", "sun"].forEach((n) => (U[n] = gl.getUniformLocation(pr, n)));
  gl.uniform1i(U.day, 0);
  gl.uniform1i(U.night, 1);

  let loaded = 0;
  const images: HTMLImageElement[] = [];
  const load = (unit: number, src: string) => {
    const t = gl.createTexture();
    const im = new Image();
    im.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      loaded++;
      if (loaded === 2) onReady();
    };
    im.onerror = () => console.warn(`globeTexture: could not load ${src} — put it in /public${src}`);
    im.src = src;
    images.push(im);
  };
  load(0, TEX_DAY);
  load(1, TEX_NIGHT);

  return {
    ready: () => loaded === 2,
    render({ width, height, cx, cy, R, dpr, yaw, tilt, simMs }) {
      if (loaded < 2) return null;
      if (cvs.width !== width || cvs.height !== height) {
        cvs.width = width;
        cvs.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.res, width, height);
      gl.uniform2f(U.ctr, cx * dpr, cy * dpr);
      gl.uniform1f(U.R, R * dpr);
      gl.uniform4f(U.view, Math.cos(yaw), Math.sin(yaw), Math.cos(tilt), Math.sin(tilt));
      const sv = sunVector(simMs);
      gl.uniform3f(U.sun, sv[0], sv[1], sv[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return cvs;
    },
    dispose() {
      images.forEach((im) => (im.onload = im.onerror = null));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
