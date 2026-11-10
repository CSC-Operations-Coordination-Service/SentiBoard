import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { asset } from "@/lib/asset";

interface ThreeEarthProps {
  /** Called once the scene exists. May return a cleanup function (event listeners, extra objects)
   *  which runs before the globe's own cleanup (renderer, geometries). */
  onReady?: (
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => void | (() => void);
  /** See-through globe: canvas with alpha channel, no scene colour. The page draws its own sky and
   *  atmosphere. Off by default. */
  transparent?: boolean;
  /** Slow spin of the Earth group. Read live, so the page can pause it without remounting.
   *  Default true. */
  autoRotate?: boolean;
  /** When true the render call is skipped (but the rAF keeps firing). Set by the parent's
   *  IntersectionObserver so GPU work stops when the stage is off-screen. */
  paused?: boolean;
}

export default function ThreeEarth({
  onReady,
  transparent = false,
  autoRotate = true,
  paused = false,
}: ThreeEarthProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef(autoRotate);
  const pausedRef = useRef(paused);
  // Keep refs in sync with props so the animate loop always reads the latest values.
  useLayoutEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  useLayoutEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = transparent ? null : new THREE.Color(0x020409);

    // Stars (opaque mode only — transparent globe shows the page's own sky)
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1200;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 100;
      starPositions[i + 1] = (Math.random() - 0.5) * 100;
      starPositions[i + 2] = (Math.random() - 0.5) * 100;
    }
    starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.8,
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    if (!transparent) scene.add(starField);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent });
    if (transparent) renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    // 2. Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // 3. Globe mesh
    const earthGroup = new THREE.Group();
    earthGroup.name = "EarthGroup";
    scene.add(earthGroup);

    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      specular: 0x334155,
      shininess: 15,
    });
    const earthMesh = new THREE.Mesh(geometry, earthMaterial);
    earthGroup.add(earthMesh);

    const atmosphereGeom = new THREE.SphereGeometry(1.05, 64, 64);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x6eaaff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
    if (!transparent) earthGroup.add(atmosphereMesh);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    textureLoader.load(
      asset("/assets/globe/earth-day.jpg"),
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        earthMaterial.map = texture;
        earthMaterial.color.setHex(0xffffff);
        earthMaterial.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn("ThreeEarth: could not load fallback texture:", err);
      },
    );

    // 4. Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null;
    ro?.observe(containerRef.current);

    // 5. Render loop — exactly one renderer.render() per frame, skipped when paused
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (autoRotateRef.current) earthGroup.rotation.y += 0.0005;
      if (!pausedRef.current) renderer.render(scene, camera);
    };
    animate();

    // Callback to parent; keep whatever cleanup it returns
    const pageCleanup = onReady?.(scene, camera, renderer);

    return () => {
      if (typeof pageCleanup === "function") pageCleanup();
      window.removeEventListener("resize", handleResize);
      ro?.disconnect();
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      renderer.forceContextLoss(); // immediately releases the WebGL context slot
      geometry.dispose();
      earthMaterial.dispose();
      atmosphereGeom.dispose();
      atmosphereMat.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        position: "relative",
        background: transparent ? "transparent" : "#020409",
        overflow: "hidden",
      }}
    />
  );
}
