import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeEarthProps {
  onReady?: (
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => void;
}

export default function ThreeEarth({ onReady }: ThreeEarthProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020409);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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
    const geometry = new THREE.SphereGeometry(1, 64, 64);

    // Default fallback material if image textures fail
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      specular: 0x334155,
      shininess: 15,
    });

    const earthMesh = new THREE.Mesh(geometry, earthMaterial);
    scene.add(earthMesh);

    // Atmosphere Glow Outer Shell
    const atmosphereGeom = new THREE.SphereGeometry(1.02, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
    scene.add(atmosphereMesh);

    // Load texture with CORS & Fallback
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    // Reliable Wikimedia / High-res CORS texture
    // NEW (clean equirectangular earth texture):
    // NEW (clean equirectangular earth texture):
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
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 5. Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Callback to parent page
    if (onReady) {
      onReady(scene, camera, renderer);
    }

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geometry.dispose();
      earthMaterial.dispose();
      atmosphereGeom.dispose();
      atmosphereMat.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#020409",
        overflow: "hidden",
      }}
    />
  );
}
