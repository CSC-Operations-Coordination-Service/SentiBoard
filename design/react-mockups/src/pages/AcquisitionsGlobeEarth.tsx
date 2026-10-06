import { useState, useEffect, useRef } from "react";
import { PageHeader, DescriptionModal } from "@/components/ui";
import * as THREE from "three";
import ThreeEarth from "@/components/ThreeEarth";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES } from "@/data/mock";

const D = Math.PI / 180;
const CONTACT_DEG = 18.5;

interface DataOverlays {
  footprints?: THREE.Object3D[];
  stations?: THREE.Group;
  satellites?: THREE.Group;
  orbits?: THREE.Line[];
}

const SAMPLE_SWATHS = [
  {
    id: "S2A-48201-1",
    color: 0x10b981, // Green swath (Central Europe)
    opacity: 0.35,
    coords: [
      [2, 60],
      [35, 56],
      [28, 38],
      [-2, 42],
    ],
  },
  {
    id: "S1C-57622",
    color: 0xef4444, // Red swath (Svalbard)
    opacity: 0.35,
    coords: [
      [14, 80],
      [28, 76],
      [22, 69],
      [8, 72],
    ],
  },
  {
    id: "S3B-080-345",
    color: 0x06b6d4, // Cyan swath (High Arctic)
    opacity: 0.35,
    coords: [
      [-135, 72],
      [-110, 68],
      [-120, 60],
      [-142, 64],
    ],
  },
  {
    id: "S2B-42050-1",
    color: 0x38bdf8, // Blue swath (North America)
    opacity: 0.35,
    coords: [
      [-105, 50],
      [-80, 48],
      [-85, 30],
      [-110, 32],
    ],
  },
  {
    id: "S5P-60012",
    color: 0xd97706, // Orange swath (Atlantic / Maspalomas)
    opacity: 0.35,
    coords: [
      [-20, 32],
      [-7, 30],
      [-12, 16],
      [-24, 18],
    ],
  },
  {
    id: "S3A-055-358",
    color: 0xf59e0b, // Yellow swath (Mediterranean)
    opacity: 0.35,
    coords: [
      [8, 46],
      [18, 44],
      [13, 38],
      [5, 40],
    ],
  },
];

export default function AcquisitionsGlobeEarthPage() {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const overlaysRef = useRef<DataOverlays>({});

  // ADD THESE TWO REFS HERE:
  const isAnimatingRef = useRef(false);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);

  const [selectedDataTake, setSelectedDataTake] = useState(0);
  const [satelliteFilter, setSatelliteFilter] = useState("*");
  const [dayFilter, setDayFilter] = useState("*");
  const [datatakeFilter, setDatatakeFilter] = useState("*");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const footprintMeshesRef = useRef<THREE.Object3D[]>([]);
  const [stationPositions, setStationPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

  // State for tracking satellite screen coordinates and labels
  const [satPositions, setSatPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

  const satObjectsRef = useRef<
    {
      name: string;
      inc: number;
      omega: number;
      speed: number;
      progress: number;
      satGroup: THREE.Group;
      beamLine: THREE.Line;
    }[]
  >([]);

  const filteredDatatakes = ACQ_DATATAKES.filter((dt) => {
    if (satelliteFilter !== "*" && dt.sat !== satelliteFilter) return false;
    if (dayFilter !== "*" && !dt.startIso.startsWith(dayFilter)) return false;
    return true;
  });

  const datatakesInView = filteredDatatakes.length;
  const acquired = Math.round(
    (filteredDatatakes.filter((dt) => dt.comp >= 0.95).length /
      Math.max(1, filteredDatatakes.length)) *
      100,
  );
  const published = Math.round(
    (filteredDatatakes.filter((dt) => dt.status === "Published").length /
      Math.max(1, filteredDatatakes.length)) *
      100,
  );
  const failedAcquisitions = filteredDatatakes.filter(
    (dt) => dt.cls === "crit",
  ).length;
  const uniqueSatellites = Array.from(
    new Set(ACQ_DATATAKES.map((dt) => dt.sat)),
  ).sort();

  const addDataOverlays = (scene: THREE.Scene, overlayGroup: THREE.Group) => {
    if (!scene) return;

    const earthGroup = scene.getObjectByName("EarthGroup") || scene;
    overlayGroup.name = "DataOverlays";
    scene.add(overlayGroup);

    earthGroup.add(overlayGroup);

    // 1. Ground Stations
    STATIONS.forEach((station) => {
      const lat = station.lat * D;
      const lon = station.lon * D;

      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon);

      const stationGeometry = new THREE.SphereGeometry(0.008, 12, 12);
      const stationMaterial = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        depthWrite: false,
        depthTest: true,
      });
      const stationMesh = new THREE.Mesh(stationGeometry, stationMaterial);
      stationMesh.position.set(x, y, z);
      stationMesh.renderOrder = 20;
      overlayGroup.add(stationMesh);

      const circleRadius = Math.sin(CONTACT_DEG * D);
      const circleGeometry = new THREE.TorusGeometry(
        circleRadius,
        0.002,
        8,
        32,
      );
      const circleMaterial = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        opacity: 0.25,
        transparent: true,
        depthWrite: false,
      });
      const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
      circleMesh.position.set(x, y, z);
      circleMesh.renderOrder = 15;
      overlayGroup.add(circleMesh);
    });

    // 2. Datatake Footprint Overlay Swaths
    footprintMeshesRef.current = [];

    SAMPLE_SWATHS.forEach((swath, idx) => {
      const points: THREE.Vector3[] = [];
      const radius = 1.003; // Slightly above ground to avoid depth fighting

      swath.coords.forEach(([lon, lat]) => {
        const lat_rad = lat * D;
        const lon_rad = lon * D;
        points.push(
          new THREE.Vector3(
            Math.cos(lat_rad) * Math.sin(lon_rad) * radius,
            Math.sin(lat_rad) * radius,
            Math.cos(lat_rad) * Math.cos(lon_rad) * radius,
          ),
        );
      });

      // Triangulated Mesh (Filled Quad Surface)
      const positions = new Float32Array([
        // First Triangle
        points[0].x,
        points[0].y,
        points[0].z,
        points[1].x,
        points[1].y,
        points[1].z,
        points[2].x,
        points[2].y,
        points[2].z,

        // Second Triangle
        points[0].x,
        points[0].y,
        points[0].z,
        points[2].x,
        points[2].y,
        points[2].z,
        points[3].x,
        points[3].y,
        points[3].z,
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals(); // Recompute normals to prevent invisible faces

      const mat = new THREE.MeshBasicMaterial({
        color: swath.color,
        opacity: swath.opacity,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 14 + idx;
      overlayGroup.add(mesh);

      // Border Stroke Line
      const closedPoints = [...points, points[0]];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(closedPoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: swath.color,
        opacity: 0.9,
        transparent: true,
        linewidth: 2,
      });

      const lineMesh = new THREE.Line(lineGeo, lineMat);
      lineMesh.renderOrder = 18 + idx;
      lineMesh.userData = {
        datatakeId: swath.id,
        fillMesh: mesh,
        baseColor: swath.color,
      };
      overlayGroup.add(lineMesh);
      footprintMeshesRef.current.push(lineMesh);
    });

    // 3. Orbit Lines & 3D Satellite Models
    const orbits = [
      {
        inc: 98.1,
        omega: 30,
        col: 0x00e5ff,
        name: "S1C",
        pos: 0.2,
        speed: 0.005,
      },
      {
        inc: 98.6,
        omega: 150,
        col: 0x38bdf8,
        name: "S2A",
        pos: 0.45,
        speed: 0.004,
      },
      {
        inc: 98.6,
        omega: 330,
        col: 0x34d399,
        name: "S2B",
        pos: 0.85,
        speed: 0.004,
      },
      {
        inc: 98.6,
        omega: 220,
        col: 0xf59e0b,
        name: "S3A",
        pos: 0.3,
        speed: 0.0045,
      },
      {
        inc: 98.6,
        omega: 255,
        col: 0x00c7d6,
        name: "S3B",
        pos: 0.75,
        speed: 0.0045,
      },
      {
        inc: 98.7,
        omega: 110,
        col: 0xe11d48,
        name: "S5P",
        pos: 0.6,
        speed: 0.0052,
      },
    ];

    satObjectsRef.current = [];

    orbits.forEach((orbit, idx) => {
      const points: THREE.Vector3[] = [];
      const orbitRadius = 1.18;

      for (let d = 0; d <= 360; d += 4) {
        const angle = (d * Math.PI) / 180;
        const inc = orbit.inc * D;
        const om = orbit.omega * D;
        const lat = Math.asin(Math.sin(inc) * Math.sin(angle));
        const lon =
          om + Math.atan2(Math.cos(inc) * Math.sin(angle), Math.cos(angle));

        points.push(
          new THREE.Vector3(
            Math.cos(lat) * Math.sin(lon) * orbitRadius,
            Math.sin(lat) * orbitRadius,
            Math.cos(lat) * Math.cos(lon) * orbitRadius,
          ),
        );
      }

      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: orbit.col,
        opacity: 0.35,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      });

      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      orbitLine.renderOrder = 10 + idx;
      overlayGroup.add(orbitLine);

      const satGroup = new THREE.Group();

      // Satellite Center Point
      const dotGeo = new THREE.SphereGeometry(0.012, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x3dd68c });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      satGroup.add(dotMesh);

      // Satellite Main Body
      const bodyGeo = new THREE.BoxGeometry(0.01, 0.01, 0.02);
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      satGroup.add(bodyMesh);

      // Solar Panels
      const panelGeo = new THREE.BoxGeometry(0.065, 0.002, 0.012);
      const panelMat = new THREE.MeshBasicMaterial({ color: orbit.col });
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      satGroup.add(panelMesh);

      satGroup.renderOrder = 30;
      overlayGroup.add(satGroup);

      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const beamMat = new THREE.LineBasicMaterial({
        color: orbit.col,
        transparent: true,
        opacity: 0.5,
      });
      const beamLine = new THREE.Line(beamGeo, beamMat);
      overlayGroup.add(beamLine);

      satObjectsRef.current.push({
        name: orbit.name,
        inc: orbit.inc,
        omega: orbit.omega,
        speed: orbit.speed,
        progress: orbit.pos * Math.PI * 2,
        satGroup,
        beamLine,
      });
    });

    // 4. Background Starfield
    const starsCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i += 3) {
      const radius = 12 + Math.random() * 20;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);
    }

    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    overlaysRef.current = {
      footprints: footprintMeshesRef.current,
      stations: overlayGroup,
    };
  };

  useEffect(() => {
    if (!footprintMeshesRef.current) return;
    footprintMeshesRef.current.forEach((mesh, idx) => {
      const isSelected = idx === selectedDataTake;
      const line = mesh as THREE.Line;
      const lineMat = line.material as THREE.LineBasicMaterial;
      const fillMesh = line.userData?.fillMesh as THREE.Mesh;
      const fillMat = fillMesh?.material as THREE.MeshBasicMaterial;
      const baseColor = line.userData?.baseColor || 0x00e5ff;

      if (isSelected) {
        lineMat.color.set(0x00e5ff);
        lineMat.opacity = 1.0;
        if (fillMat) {
          fillMat.color.set(0x00e5ff);
          fillMat.opacity = 0.55; // Brighter fill on selection
        }
      } else {
        lineMat.color.set(baseColor);
        lineMat.opacity = 0.7;
        if (fillMat) {
          fillMat.color.set(baseColor);
          fillMat.opacity = 0.3;
        }
      }
    });
  }, [selectedDataTake]);

  // Helper to compute geographic center of polygon coordinates
  const getSwathCentroid = (coords: number[][]) => {
    const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    return { lon: avgLon, lat: avgLat };
  };

  // Function to move the camera focus to a target datatake coordinate
  const focusOnDatatake = (coords: number[][]) => {
    if (!cameraRef.current) return;

    const { lon, lat } = getSwathCentroid(coords);
    const latRad = lat * D;
    const lonRad = lon * D;

    // Keep the current zoom level (distance from earth center)
    const distance = cameraRef.current.position.length();

    // Compute unit vector on sphere for target position
    const targetDir = new THREE.Vector3(
      Math.cos(latRad) * Math.sin(lonRad),
      Math.sin(latRad),
      Math.cos(latRad) * Math.cos(lonRad),
    ).normalize();

    targetCamPosRef.current = targetDir.multiplyScalar(distance);
    isAnimatingRef.current = true;
  };

  const handleSceneReady = (
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => {
    sceneRef.current = scene;
    cameraRef.current = camera as THREE.PerspectiveCamera;
    rendererRef.current = renderer;

    camera.position.set(0, 0, 3.0);
    camera.lookAt(0, 0, 0);

    const overlayGroup = new THREE.Group();
    addDataOverlays(scene, overlayGroup);

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging && camera) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        camera.position.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          deltaX * 0.008,
        );
        camera.position.applyAxisAngle(
          new THREE.Vector3(1, 0, 0),
          deltaY * 0.008,
        );
        camera.lookAt(0, 0, 0);

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (camera) {
        const direction = camera.position.clone().normalize();
        const currentDistance = camera.position.length();
        const newDistance = Math.max(
          1.6,
          Math.min(6, currentDistance + e.deltaY * 0.004),
        );
        camera.position.copy(direction.multiplyScalar(newDistance));
        camera.lookAt(0, 0, 0);
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
    };
  };

  useEffect(() => {
    let animId: number;

    const animateSatellites = () => {
      // --- ADD THIS CAMERA INTERPOLATION BLOCK AT THE TOP ---
      if (
        isAnimatingRef.current &&
        targetCamPosRef.current &&
        cameraRef.current
      ) {
        cameraRef.current.position.lerp(targetCamPosRef.current, 0.06);
        cameraRef.current.lookAt(0, 0, 0);

        // Stop animating once camera gets very close
        if (
          cameraRef.current.position.distanceTo(targetCamPosRef.current) < 0.005
        ) {
          cameraRef.current.position.copy(targetCamPosRef.current);
          isAnimatingRef.current = false;
        }
      }

      const orbitRadius = 1.18;

      satObjectsRef.current.forEach((sat) => {
        // Advance progress angle
        sat.progress += sat.speed;
        if (sat.progress > Math.PI * 2) sat.progress -= Math.PI * 2;

        const inc = sat.inc * D;
        const om = sat.omega * D;
        const angle = sat.progress;

        const lat = Math.asin(Math.sin(inc) * Math.sin(angle));
        const lon =
          om + Math.atan2(Math.cos(inc) * Math.sin(angle), Math.cos(angle));

        const satPos = new THREE.Vector3(
          Math.cos(lat) * Math.sin(lon) * orbitRadius,
          Math.sin(lat) * orbitRadius,
          Math.cos(lat) * Math.cos(lon) * orbitRadius,
        );

        sat.satGroup.position.copy(satPos);
        sat.satGroup.lookAt(0, 0, 0);

        // Update ground beam path line
        const groundPos = satPos.clone().normalize().multiplyScalar(1.0);
        const positions = sat.beamLine.geometry.attributes
          .position as THREE.BufferAttribute;
        if (positions) {
          positions.setXYZ(0, satPos.x, satPos.y, satPos.z);
          positions.setXYZ(1, groundPos.x, groundPos.y, groundPos.z);
          positions.needsUpdate = true;
        }
      });

      // Update Screen Coordinates for 2D Labels
      if (cameraRef.current && rendererRef.current) {
        const camera = cameraRef.current as THREE.PerspectiveCamera;
        const renderer = rendererRef.current;
        const canvas = renderer.domElement;
        const stationPosMap: Record<
          string,
          { x: number; y: number; visible: boolean }
        > = {};
        const satPosMap: Record<
          string,
          { x: number; y: number; visible: boolean }
        > = {};

        // Update Ground Stations 2D Positions
        STATIONS.forEach((station) => {
          const lat = station.lat * D;
          const lon = station.lon * D;
          const worldPos = new THREE.Vector3(
            Math.cos(lat) * Math.sin(lon),
            Math.sin(lat),
            Math.cos(lat) * Math.cos(lon),
          );
          const camPos = camera.position.clone();
          const isVisible =
            worldPos.clone().normalize().dot(camPos.normalize()) > 0.15;
          const vector = worldPos.clone().project(camera);
          stationPosMap[station.name] = {
            x: (vector.x * 0.5 + 0.5) * canvas.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * canvas.clientHeight,
            visible: isVisible,
          };
        });

        // Update Satellites 2D Positions
        satObjectsRef.current.forEach((sat) => {
          const worldPos = sat.satGroup.position.clone();
          const camPos = camera.position.clone();
          const isVisible =
            worldPos.clone().normalize().dot(camPos.normalize()) > 0.0;
          const vector = worldPos.clone().project(camera);
          satPosMap[sat.name] = {
            x: (vector.x * 0.5 + 0.5) * canvas.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * canvas.clientHeight,
            visible: isVisible,
          };
        });

        setStationPositions(stationPosMap);
        setSatPositions(satPosMap);
      }

      animId = requestAnimationFrame(animateSatellites);
    };

    animateSatellites();
    return () => cancelAnimationFrame(animId);
  }, []);

  const [descriptionOpen, setDescriptionOpen] = useState(false);

  return (
    <div
      style={{
        background: "#020409",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* PAGE HEADER */}
      <PageHeader
        crumb="Acquisitions Status"
        title="Acquisitions Status"
        img="/assets/img/nebula.jpg"
      />

      <div
        style={{
          width: "100%",
          padding: "0 clamp(18px, 4vw, 48px)",
          boxSizing: "border-box",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            margin: "0",
            padding: "0",
          }}
        >
          <div style={{ marginTop: "16px" }}>
            <button
              type="button"
              style={{
                cursor: "pointer",
                padding: "12px 16px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "0",
                background: "#343a40",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#9aa4b4",
                transition: "color 0.2s, background 0.2s",
                whiteSpace: "nowrap",
                marginLeft: "0 !important" as any,
                alignSelf: "flex-start !important" as any,
              }}
              onClick={() => setDescriptionOpen(true)}
              aria-expanded={descriptionOpen}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#eef1f6";
                e.currentTarget.style.background = "rgba(0, 199, 214, 0.13)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9aa4b4";
                e.currentTarget.style.background = "#343a40";
              }}
            >
              <span>Description</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00c7d6"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          <DescriptionModal
            open={descriptionOpen}
            onClose={() => setDescriptionOpen(false)}
          >
            <div style={{ color: "#eef1f6" }}>
              <p>{ACQUISITIONS_DESCRIPTION}</p>
            </div>
          </DescriptionModal>
        </div>
      </div>

      {/* KPI Section */}
      <div
        style={{
          background: "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 0",
          display: "flex",
          justifyContent: "center",
          gap: "64px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: "4px",
            }}
          >
            DATATAKES IN VIEW
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: "sans-serif",
            }}
          >
            {datatakesInView}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: "4px",
            }}
          >
            ACQUIRED
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: "sans-serif",
            }}
          >
            {acquired}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "4px",
            }}
          >
            PUBLISHED
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: "sans-serif",
            }}
          >
            {published}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "13px",
              fontFamily: "monospace",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "4px",
            }}
          >
            FAILED ACQUISITIONS
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: failedAcquisitions > 0 ? "#ef4444" : "#fff",
              fontFamily: "sans-serif",
            }}
          >
            {failedAcquisitions}
          </div>
        </div>
      </div>

      {/* CENTERED FILTER TOOLBAR */}
      <div
        style={{
          position: "relative",
          zIndex: 50,
          background: "transparent",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "36px",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#fff",
            letterSpacing: "0.05em",
          }}
        >
          15 - 16 JULY 2026
        </div>

        {/* SATELLITE Dropdown */}
        <div
          style={{
            position: "relative",
            borderBottom: "1px solid rgba(255,255,255,0.25)",
            paddingBottom: "2px",
          }}
        >
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === "sat" ? null : "sat")
            }
            style={{
              background: "none",
              border: "none",
              color: "#8a96a8",
              fontSize: "15px",
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: 0,
            }}
          >
            <span style={{ textTransform: "uppercase" }}>SATELLITE</span>
            <span style={{ color: "#fff", fontWeight: "600" }}>
              {satelliteFilter === "*" ? "All" : satelliteFilter}
            </span>
            <span style={{ fontSize: "15px", color: "#8a96a8" }}>▼</span>
          </button>
          {openDropdown === "sat" && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                background: "#090d16",
                border: "1px solid rgba(255,255,255,0.2)",
                zIndex: 100,
                minWidth: "180px",
                padding: "8px 0",
              }}
            >
              {["*", ...uniqueSatellites].map((sat) => (
                <button
                  key={sat}
                  type="button"
                  onClick={() => {
                    setSatelliteFilter(sat);
                    setOpenDropdown(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: satelliteFilter === sat ? "#00c7d6" : "#fff",
                    padding: "8px 16px",
                    textAlign: "left",
                    fontFamily: "monospace",
                    fontSize: "15px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  {sat === "*" ? "All satellites" : sat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DAY OF ACQUISITION Dropdown */}
        <div
          style={{
            position: "relative",
            borderBottom: "1px solid rgba(255,255,255,0.25)",
            paddingBottom: "2px",
          }}
        >
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === "day" ? null : "day")
            }
            style={{
              background: "none",
              border: "none",
              color: "#8a96a8",
              fontSize: "13px",
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: 0,
            }}
          >
            <span
              style={{
                color: openDropdown === "day" ? "#00c7d6" : "#8a96a8",
                textTransform: "uppercase",
              }}
            >
              DAY OF ACQUISITION
            </span>
            <span style={{ color: "#fff", fontWeight: "700" }}>
              {dayFilter === "*" ? "Any" : dayFilter}
            </span>
            <span style={{ fontSize: "10px", color: "#8a96a8" }}>▼</span>
          </button>

          {openDropdown === "day" && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                background: "#050811",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                zIndex: 100,
                width: "260px",
                padding: "16px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.8)",
                fontFamily: "monospace",
              }}
            >
              {/* ANY DAY Header Option */}
              <div
                onClick={() => {
                  setDayFilter("*");
                  setOpenDropdown(null);
                }}
                style={{
                  color: dayFilter === "*" ? "#00c7d6" : "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "700",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                ANY DAY
              </div>

              {/* Month Navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "700",
                  letterSpacing: "0.05em",
                }}
              >
                <span style={{ cursor: "pointer", color: "#8a96a8" }}>‹</span>
                <span>JULY 2026</span>
                <span style={{ cursor: "pointer", color: "#8a96a8" }}>›</span>
              </div>

              {/* Days of the Week Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  textAlign: "center",
                  color: "#8a96a8",
                  fontSize: "10px",
                  fontWeight: "700",
                  marginBottom: "8px",
                }}
              >
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>

              {/* Calendar Grid Days */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  rowGap: "8px",
                  textAlign: "center",
                  color: "#fff",
                  fontSize: "11px",
                }}
              >
                {/* Empty cells for Monday/Tuesday alignment offset */}
                <span />
                <span />

                {[...Array(31)].map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `2026-07-${dayNum.toString().padStart(2, "0")}`;
                  const isSelected = dayFilter === dateStr;
                  const hasAcquisition = dayNum === 15 || dayNum === 16;

                  return (
                    <div
                      key={dayNum}
                      onClick={() => {
                        setDayFilter(dateStr);
                        setOpenDropdown(null);
                      }}
                      style={{
                        cursor: "pointer",
                        padding: "4px 0",
                        borderRadius: "2px",
                        position: "relative",
                        fontWeight:
                          isSelected || hasAcquisition ? "700" : "400",
                        color: isSelected ? "#00c7d6" : "#fff",
                      }}
                    >
                      {dayNum}
                      {hasAcquisition && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "0px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "3px",
                            height: "3px",
                            borderRadius: "50%",
                            backgroundColor: "#00c7d6",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  marginTop: "16px",
                }}
              />
            </div>
          )}
        </div>

        {/* DATATAKE Dropdown */}
        <div
          style={{
            position: "relative",
            borderBottom: "1px solid rgba(255,255,255,0.25)",
            paddingBottom: "2px",
          }}
        >
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === "dtk" ? null : "dtk")
            }
            style={{
              background: "none",
              border: "none",
              color: "#8a96a8",
              fontSize: "15px",
              fontFamily: "monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: 0,
            }}
          >
            <span style={{ textTransform: "uppercase" }}>DATATAKE</span>
            <span style={{ color: "#fff", fontWeight: "800" }}>None</span>
            <span style={{ fontSize: "15px", color: "#8a96a8" }}>▼</span>
          </button>
          {openDropdown === "dtk" && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                background: "#090d16",
                border: "1px solid rgba(255,255,255,0.2)",
                zIndex: 100,
                minWidth: "280px",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "8px 0",
              }}
            >
              {ACQ_DATATAKES.slice(0, 10).map((dt) => {
                const statusColor =
                  dt.cls === "ok"
                    ? "#3dd68c"
                    : dt.cls === "warn"
                      ? "#f5b544"
                      : "#ef4444";
                return (
                  <div
                    key={dt.id}
                    onClick={() => {
                      setDatatakeFilter(dt.id);
                      setSelectedDataTake(ACQ_DATATAKES.indexOf(dt));
                      setOpenDropdown(null);
                      const matchedSwath = SAMPLE_SWATHS.find(
                        (s) => s.id === dt.id,
                      );
                      if (matchedSwath) {
                        focusOnDatatake(matchedSwath.coords);
                      }
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      padding: "8px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      color: datatakeFilter === dt.id ? "#00c7d6" : "#fff",
                      fontSize: "15px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          background: statusColor,
                          borderRadius: "50%",
                        }}
                      />
                      <span>{dt.id}</span>
                    </div>
                    <span style={{ fontSize: "13px", color: "#8a96a8" }}>
                      {Math.round(dt.comp * 100)}% · {dt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SEARCH INPUT */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "#8a96a8", fontSize: "15px" }}>🔍</span>
          <input
            type="text"
            placeholder="Datatake ID"
            style={{
              background: "none",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              fontSize: "15px",
              fontFamily: "monospace",
              outline: "none",
              width: "100px",
              paddingBottom: "2px",
            }}
          />
        </div>
      </div>

      {/* GLOBE CANVAS CONTAINER WITH EXPLICIT HEIGHT */}
      <div
        style={{
          flex: 1,
          minHeight: "550px",
          position: "relative",
          overflow: "hidden",
          width: "100%",
        }}
      >
        {/* THREE.JS CANVAS */}
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <ThreeEarth onReady={handleSceneReady} />
        </div>

        {/* Zoom Controls */}
        <div
          style={{
            position: "absolute",
            right: "32px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <button
            onClick={() => {
              if (cameraRef.current) {
                const direction = cameraRef.current.position
                  .clone()
                  .normalize();
                const currentDistance = cameraRef.current.position.length();
                const newDistance = Math.max(1.6, currentDistance * 0.85);
                cameraRef.current.position.copy(
                  direction.multiplyScalar(newDistance),
                );
                cameraRef.current.lookAt(0, 0, 0);
              }
            }}
            style={{
              width: "36px",
              height: "36px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#00e5ff",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            +
          </button>
          <button
            onClick={() => {
              if (cameraRef.current) {
                const direction = cameraRef.current.position
                  .clone()
                  .normalize();
                const dist = cameraRef.current.position.length();
                cameraRef.current.position.copy(
                  direction.multiplyScalar(Math.min(6, dist * 1.15)),
                );
                cameraRef.current.lookAt(0, 0, 0);
              }
            }}
            style={{
              width: "36px",
              height: "36px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#00e5ff",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            −
          </button>
          <button
            onClick={() => {
              if (cameraRef.current) {
                cameraRef.current.position.set(0, 0, 3.0);
                cameraRef.current.lookAt(0, 0, 0);
              }
            }}
            style={{
              width: "36px",
              height: "36px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#00e5ff",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ↻
          </button>
        </div>

        {/* 2D Overlay Badges */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {STATIONS.map((station, idx) => {
            const pos = stationPositions[station.name];
            if (!pos || !pos.visible || (pos.x === 0 && pos.y === 0))
              return null;

            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: "translate(-50%, -100%)",
                  background: "rgba(9, 21, 37, 0.88)",
                  border: "1px solid #00e5ff",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "sans-serif",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 0 10px rgba(0,229,255,0.35)",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00e5ff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a10 10 0 0 0-10 10" />
                  <path d="M12 6a6 6 0 0 0-6 6" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M12 14v8" />
                </svg>{" "}
                <span>{station.name}</span>
              </div>
            );
          })}
          {/* Satellite Orbit Labels (matching S3B, S1C, S2A in image) */}
          {Object.entries(satPositions).map(([satName, pos]) => {
            if (!pos || !pos.visible) return null;

            return (
              <div
                key={`sat-${satName}`}
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  pointerEvents: "none",
                }}
              >
                {/* Green Status Dot Circle */}
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#3dd68c",
                    border: "1px solid #000",
                    boxShadow: "0 0 6px #3dd68c",
                  }}
                />
                {/* Clean Semi-Transparent Font Overlay */}
                <span
                  style={{
                    color: "#ffffff",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    fontFamily: "sans-serif",
                    letterSpacing: "0.03em",
                    textShadow: "0 0 4px #000, 0 0 2px #000",
                  }}
                >
                  {satName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
