import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeEarthProps {
  /** Called once the scene exists. May return a cleanup function (event listeners, extra objects),
   *  which runs when the globe unmounts. */
  onReady?: (
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => void | (() => void);
  /** See-through globe, as SentiBoard.html#acquisitions: a canvas with an alpha channel cleared to
   *  nothing, no scene colour, no wrapper fill, and none of this component's own stars or glow
   *  shell — the page behind supplies the sky, and the page draws its own atmosphere. Off by
   *  default, so any other page using ThreeEarth keeps its current look. */
  transparent?: boolean;
}

export default function ThreeEarth({
  onReady,
  transparent = false,
}: ThreeEarthProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = transparent ? null : new THREE.Color(0x020409);

    // Create Starfield Background Particles (opaque mode only: a transparent globe shows the
    // page's own sky instead)
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1200;
    const starPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 100;
      starPositions[i + 1] = (Math.random() - 0.5) * 100;
      starPositions[i + 2] = (Math.random() - 0.5) * 100;
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );

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

    // The alpha channel is fixed when the context is created: without `alpha: true` the canvas can
    // never be see-through, whatever setClearColor says later.
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparent,
    });
    if (transparent) renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Clear old canvases
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // 3. Globe Mesh + Safe Texture Loading
    const earthGroup = new THREE.Group();
    earthGroup.name = "EarthGroup";
    scene.add(earthGroup);

    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Default fallback material if image textures fail
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      specular: 0x334155,
      shininess: 15,
    });

    // FIXED: Added earthMesh directly into earthGroup so rotation affects it[cite: 18]
    const earthMesh = new THREE.Mesh(geometry, earthMaterial);
    earthGroup.add(earthMesh);

    // Atmosphere Glow Outer Shell
    const atmosphereGeom = new THREE.SphereGeometry(1.05, 64, 64);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x6eaaff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
    // In transparent mode the page draws the reference's rim gradient instead; two glows would stack.
    if (!transparent) earthGroup.add(atmosphereMesh); // FIXED: Added to group[cite: 18]

    // Load texture with CORS & Fallback
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    const textureUrl = "/assets/textures/earth_atmos_2048.jpg";

    textureLoader.load(
      textureUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        earthMaterial.map = texture;
        earthMaterial.color.setHex(0xffffff);
        earthMaterial.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(
          "Could not load Earth texture, using fallback dark blue material:",
          err,
        );
      },
    );

    // 4. Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      // FIXED: Safeguard against clientHeight returning 0[cite: 18]
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 5. Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      earthGroup.rotation.y += 0.0005; // Rotates earthMesh, atmosphereMesh, and innerGlowMesh[cite: 18]
      renderer.render(scene, camera);
    };
    animate();

    // Callback to parent page; keep whatever cleanup it hands back
    const pageCleanup = onReady?.(scene, camera, renderer);

    // Cleanup
    return () => {
      if (typeof pageCleanup === "function") pageCleanup();
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geometry.dispose();
      earthMaterial.dispose();
      atmosphereGeom.dispose();
      atmosphereMat.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px", // FIXED: Prevents container height collapsing to 0[cite: 18]
        position: "relative",
        background: transparent ? "transparent" : "#020409",
        overflow: "hidden",
      }}
    />
  );
}
