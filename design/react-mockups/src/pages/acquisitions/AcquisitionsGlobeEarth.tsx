import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/ui";
import * as THREE from "three";
import ThreeEarth from "@/components/ThreeEarth";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES } from "@/data/mock";

const D = Math.PI / 180;

const DESCRIPTION = (
  <>
    <p>{ACQUISITIONS_DESCRIPTION}</p>
  </>
);

const SAMPLE_SWATHS = [
  {
    id: "S2A-48201-1",
    color: 0x10b981,
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
    color: 0xef4444,
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
    color: 0x06b6d4,
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
    color: 0x38bdf8,
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
    color: 0xd97706,
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
    color: 0xf59e0b,
    opacity: 0.35,
    coords: [
      [8, 46],
      [18, 44],
      [13, 38],
      [5, 40],
    ],
  },
];

const SAMPLE_SATELLITES = [
  { name: "S1C", inc: 98.18, omega: 15, speed: 0.0018, color: 0x3dd68c },
  { name: "S2A", inc: 98.62, omega: 65, speed: 0.0015, color: 0x38bdf8 },
  { name: "S3B", inc: 98.65, omega: 140, speed: 0.002, color: 0xf59e0b },
];

const SPEED_OPTIONS = [1, 10, 60, 100, 300, 1000];

const formatSimTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}Z`;
};

export default function AcquisitionsGlobeEarthPage() {
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const isAnimatingRef = useRef(false);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);

  const [selectedDataTake, setSelectedDataTake] = useState<number>(0);
  const [satelliteFilter, setSatelliteFilter] = useState("*");
  const [dayFilter, setDayFilter] = useState("*");
  const [datatakeFilter, setDatatakeFilter] = useState<string>("*");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const footprintMeshesRef = useRef<THREE.Object3D[]>([]);
  const clickableMeshesRef = useRef<THREE.Mesh[]>([]);

  const [stationPositions, setStationPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});
  const [satPositions, setSatPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

  // Simulation Time States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(60);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

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

  // List of datatakes available for the dropdown options ( filtered by Satellite, Day, and Search — but NOT Datatake ID )
  const dropdownDatatakes = ACQ_DATATAKES.filter((dt) => {
    if (satelliteFilter !== "*" && dt.sat !== satelliteFilter) return false;
    if (dayFilter !== "*" && !dt.startIso.startsWith(dayFilter)) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      const matchId = dt.id.toLowerCase().includes(q);
      const matchSat = dt.sat.toLowerCase().includes(q);
      if (!matchId && !matchSat) return false;
    }
    return true;
  });

  // Final filtered datatakes applied to globe 3D view and KPI calculation
  const filteredDatatakes = dropdownDatatakes.filter((dt) => {
    if (datatakeFilter !== "*" && dt.id !== datatakeFilter) return false;
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

  const latLonToVector3 = (
    latDeg: number,
    lonDeg: number,
    radius: number = 1.004,
  ): THREE.Vector3 => {
    const lat = latDeg * D;
    const lon = (lonDeg + 90) * D;

    return new THREE.Vector3(
      Math.cos(lat) * Math.sin(lon) * radius,
      Math.sin(lat) * radius,
      Math.cos(lat) * Math.cos(lon) * radius,
    );
  };

  const getSwathCentroid = (coords: number[][]) => {
    const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    return { lon: avgLon, lat: avgLat };
  };

  const focusOnDatatake = (coords: number[][]) => {
    if (!cameraRef.current) return;

    const { lon, lat } = getSwathCentroid(coords);
    const targetDir = latLonToVector3(lat, lon, 1.0).normalize();
    const distance = cameraRef.current.position.length();

    targetCamPosRef.current = targetDir.multiplyScalar(distance);
    isAnimatingRef.current = true;
  };

  const handleSelectDatatake = (dtId: string) => {
    const index = ACQ_DATATAKES.findIndex((dt) => dt.id === dtId);
    if (index !== -1) {
      setSelectedDataTake(index);
    }
    setDatatakeFilter(dtId);
    setIsModalOpen(true);

    const matchedSwath = SAMPLE_SWATHS.find((s) => s.id === dtId);
    if (matchedSwath) {
      focusOnDatatake(matchedSwath.coords);
    }
  };

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speedMultiplier);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSpeedMultiplier(SPEED_OPTIONS[nextIndex]);
  };

  useEffect(() => {
    if (filteredDatatakes.length > 0) {
      const firstDt = filteredDatatakes[0];
      const index = ACQ_DATATAKES.findIndex((dt) => dt.id === firstDt.id);
      if (index !== -1) {
        setSelectedDataTake(index);
        setDatatakeFilter(firstDt.id); // <-- ADD THIS LINE
      }
    }
  }, []);

  useEffect(() => {
    const allowedIds = new Set(filteredDatatakes.map((dt) => dt.id));

    clickableMeshesRef.current.forEach((mesh) => {
      const dtId = mesh.userData.datatakeId;
      mesh.visible = allowedIds.has(dtId);
    });

    footprintMeshesRef.current.forEach((mesh, idx) => {
      const line = mesh as THREE.Line;
      const dtId = line.userData?.datatakeId;
      line.visible = allowedIds.has(dtId);

      const isSelected = idx === selectedDataTake;
      const lineMat = line.material as THREE.LineBasicMaterial;
      const fillMesh = line.userData?.fillMesh as THREE.Mesh;
      const fillMat = fillMesh?.material as THREE.MeshBasicMaterial;
      const baseColor = line.userData?.baseColor || 0x00e5ff;

      if (isSelected) {
        lineMat.color.set(0x00e5ff);
        lineMat.opacity = 1.0;
        if (fillMat) {
          fillMat.color.set(0x00e5ff);
          fillMat.opacity = 0.65;
        }
      } else {
        lineMat.color.set(baseColor);
        lineMat.opacity = 0.7;
        if (fillMat) {
          fillMat.color.set(baseColor);
          fillMat.opacity = 0.35;
        }
      }
    });
  }, [filteredDatatakes, selectedDataTake]);

  const addDataOverlays = (scene: THREE.Scene, overlayGroup: THREE.Group) => {
    if (!scene) return;

    const earthGroup = scene.getObjectByName("EarthGroup") || scene;
    overlayGroup.name = "DataOverlays";
    earthGroup.add(overlayGroup);

    footprintMeshesRef.current = [];
    clickableMeshesRef.current = [];
    satObjectsRef.current = [];

    SAMPLE_SWATHS.forEach((swath, idx) => {
      const radius = 1.004;
      const corners = swath.coords;

      const gridSteps = 24;
      const positions: number[] = [];

      for (let u = 0; u < gridSteps; u++) {
        for (let v = 0; v < gridSteps; v++) {
          const u1 = u / gridSteps;
          const u2 = (u + 1) / gridSteps;
          const v1 = v / gridSteps;
          const v2 = (v + 1) / gridSteps;

          const getPt = (uVal: number, vVal: number) => {
            const lon =
              (1 - uVal) * (1 - vVal) * corners[0][0] +
              uVal * (1 - vVal) * corners[1][0] +
              uVal * vVal * corners[2][0] +
              (1 - uVal) * vVal * corners[3][0];
            const lat =
              (1 - uVal) * (1 - vVal) * corners[0][1] +
              uVal * (1 - vVal) * corners[1][1] +
              uVal * vVal * corners[2][1] +
              (1 - uVal) * vVal * corners[3][1];
            return latLonToVector3(lat, lon, radius);
          };

          const p00 = getPt(u1, v1);
          const p10 = getPt(u2, v1);
          const p11 = getPt(u2, v2);
          const p01 = getPt(u1, v2);

          positions.push(p00.x, p00.y, p00.z);
          positions.push(p10.x, p10.y, p10.z);
          positions.push(p11.x, p11.y, p11.z);

          positions.push(p00.x, p00.y, p00.z);
          positions.push(p11.x, p11.y, p11.z);
          positions.push(p01.x, p01.y, p01.z);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );

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
      mesh.userData = { datatakeId: swath.id, swathIndex: idx };
      overlayGroup.add(mesh);
      clickableMeshesRef.current.push(mesh);

      const borderPoints: THREE.Vector3[] = [];
      const borderSteps = 16;

      for (let c = 0; c < corners.length; c++) {
        const start = corners[c];
        const end = corners[(c + 1) % corners.length];
        for (let s = 0; s < borderSteps; s++) {
          const t = s / borderSteps;
          const lon = start[0] + (end[0] - start[0]) * t;
          const lat = start[1] + (end[1] - start[1]) * t;
          borderPoints.push(latLonToVector3(lat, lon, radius + 0.001));
        }
      }
      borderPoints.push(borderPoints[0]);

      const lineGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: swath.color,
        opacity: 0.9,
        transparent: true,
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

    const orbitRadius = 1.18;
    SAMPLE_SATELLITES.forEach((satData, idx) => {
      const orbitPoints: THREE.Vector3[] = [];
      const orbitSegments = 128;
      const inc = satData.inc * D;
      const om = (satData.omega + 90) * D;

      for (let i = 0; i <= orbitSegments; i++) {
        const angle = (i / orbitSegments) * Math.PI * 2;
        const lat = Math.asin(Math.sin(inc) * Math.sin(angle));
        const lon =
          om + Math.atan2(Math.cos(inc) * Math.sin(angle), Math.cos(angle));

        orbitPoints.push(
          new THREE.Vector3(
            Math.cos(lat) * Math.sin(lon) * orbitRadius,
            Math.sin(lat) * orbitRadius,
            Math.cos(lat) * Math.cos(lon) * orbitRadius,
          ),
        );
      }

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: satData.color,
        opacity: 0.65,
        transparent: true,
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      overlayGroup.add(orbitLine);

      const satGroup = new THREE.Group();
      const satGeo = new THREE.SphereGeometry(0.02, 16, 16);
      const satMat = new THREE.MeshBasicMaterial({
        color: satData.color,
      });
      const satMesh = new THREE.Mesh(satGeo, satMat);
      satGroup.add(satMesh);
      overlayGroup.add(satGroup);

      const beamGeo = new THREE.BufferGeometry();
      beamGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3),
      );
      const beamMat = new THREE.LineBasicMaterial({
        color: satData.color,
        opacity: 0.5,
        transparent: true,
      });
      const beamLine = new THREE.Line(beamGeo, beamMat);
      overlayGroup.add(beamLine);

      satObjectsRef.current.push({
        name: satData.name,
        inc: satData.inc,
        omega: satData.omega,
        speed: satData.speed,
        progress: (idx * Math.PI) / 1.5,
        satGroup,
        beamLine,
      });
    });
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
    let dragDistance = 0;
    let previousMousePosition = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging && camera) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

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

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;

      if (dragDistance < 5 && camera && renderer) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouseVector, camera);

        const activeClickables = clickableMeshesRef.current.filter(
          (m) => m.visible,
        );
        const intersects = raycaster.intersectObjects(activeClickables, false);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object as THREE.Mesh;
          const dtId = hitMesh.userData.datatakeId;
          if (dtId) {
            handleSelectDatatake(dtId);
          }
        }
      }
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
    let lastTimestamp = performance.now();

    const animateSatellites = (now: number) => {
      const deltaSec = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlayingRef.current) {
        setSimTime((prevTime) => {
          const nextTime =
            (prevTime + deltaSec * speedMultiplierRef.current) % 86400;
          return nextTime;
        });
      }

      if (
        isAnimatingRef.current &&
        targetCamPosRef.current &&
        cameraRef.current
      ) {
        cameraRef.current.position.lerp(targetCamPosRef.current, 0.06);
        cameraRef.current.lookAt(0, 0, 0);

        if (
          cameraRef.current.position.distanceTo(targetCamPosRef.current) < 0.005
        ) {
          cameraRef.current.position.copy(targetCamPosRef.current);
          isAnimatingRef.current = false;
        }
      }

      const orbitRadius = 1.18;

      satObjectsRef.current.forEach((sat) => {
        if (isPlayingRef.current) {
          sat.progress += sat.speed * (speedMultiplierRef.current / 30);
          if (sat.progress > Math.PI * 2) sat.progress -= Math.PI * 2;
        }

        const inc = sat.inc * D;
        const om = (sat.omega + 90) * D;
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

        const groundPos = satPos.clone().normalize().multiplyScalar(1.004);
        const positions = sat.beamLine.geometry.attributes
          .position as THREE.BufferAttribute;
        if (positions) {
          positions.setXYZ(0, satPos.x, satPos.y, satPos.z);
          positions.setXYZ(1, groundPos.x, groundPos.y, groundPos.z);
          positions.needsUpdate = true;
        }
      });

      if (cameraRef.current && rendererRef.current && sceneRef.current) {
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

        const earthGroup = sceneRef.current.getObjectByName("EarthGroup");

        STATIONS.forEach((station) => {
          const localPos = latLonToVector3(station.lat, station.lon, 1.0);

          const worldPos = earthGroup
            ? localPos.clone().applyMatrix4(earthGroup.matrixWorld)
            : localPos;

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

    animId = requestAnimationFrame(animateSatellites);
    return () => cancelAnimationFrame(animId);
  }, []);

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
      <PageHeader
        title="Acquisitions Status"
        subtitle="Past, current and planned Sentinel acquisitions on an interactive 3D globe."
        desc={DESCRIPTION}
        img="/assets/img/modules/acquisitions.jpg"
      />

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

      {/* FILTER TOOLBAR */}
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
            <span style={{ color: "#fff", fontWeight: "800" }}>
              {datatakeFilter === "*" ? "All" : datatakeFilter}
            </span>
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
              <div
                onClick={() => {
                  setDatatakeFilter("*");
                  setOpenDropdown(null);
                }}
                style={{
                  padding: "8px 16px",
                  cursor: "pointer",
                  color: datatakeFilter === "*" ? "#00c7d6" : "#fff",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                ALL DATATAKES
              </div>
              {dropdownDatatakes.map((dt) => {
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
                      setOpenDropdown(null);
                      handleSelectDatatake(dt.id);
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      padding: "8px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      color: datatakeFilter === dt.id ? "#00c7d6" : "#fff",
                      fontSize: "14px",
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
                    <span style={{ fontSize: "12px", color: "#8a96a8" }}>
                      {Math.round(dt.comp)}% · {dt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SEARCH INPUT & CLEAR BUTTON */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: "#8a96a8", fontSize: "15px" }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredDatatakes.length > 0) {
                handleSelectDatatake(filteredDatatakes[0].id);
              }
            }}
            placeholder="Search ID (e.g. S2A)"
            style={{
              background: "none",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              fontSize: "14px",
              fontFamily: "monospace",
              outline: "none",
              width: "140px",
              paddingBottom: "2px",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                color: "#8a96a8",
                fontSize: "14px",
                cursor: "pointer",
                padding: "0 2px",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* GLOBE CANVAS CONTAINER */}
      <div
        style={{
          flex: 1,
          minHeight: "550px",
          position: "relative",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <ThreeEarth onReady={handleSceneReady} />
        </div>

        {/* FLOATING BOTTOM OVERLAY CONTROL BAR */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            left: "32px",
            right: "32px",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: "20px",
            pointerEvents: "auto",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Circular Play / Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: "#00a8b5",
              border: "none",
              color: "#090d16",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 0 12px rgba(0, 168, 181, 0.4)",
            }}
          >
            {isPlaying ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Timestamp Display */}
          <div
            style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              2026-07-16 {formatSimTime(simTime)}
            </span>
            <span
              style={{
                color: "#6b7280",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              SIMULATION TIME
            </span>
          </div>

          {/* Timeline Slider Track */}
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={86400}
              step={1}
              value={Math.floor(simTime)}
              onChange={(e) => setSimTime(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "#00c7d6",
                cursor: "pointer",
                height: "4px",
              }}
            />
          </div>

          {/* Single Speed Control Pill Button */}
          <button
            onClick={handleCycleSpeed}
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "16px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              backdropFilter: "blur(8px)",
              flexShrink: 0,
            }}
          >
            ×{speedMultiplier}
          </button>
        </div>

        {/* DATATAKE DETAIL POP-UP MODAL */}
        {isModalOpen &&
          (() => {
            const dt = ACQ_DATATAKES[selectedDataTake] || ACQ_DATATAKES[0];
            if (!dt) return null;

            const percent = Math.round(dt.comp || 0);
            const statusColor =
              dt.cls === "ok"
                ? "#3dd68c"
                : dt.cls === "warn"
                  ? "#f5b544"
                  : "#ef4444";

            return (
              <div
                style={{
                  position: "absolute",
                  top: "24px",
                  right: "80px",
                  bottom: "90px",
                  zIndex: 100,
                  width: "320px",
                  background: "rgba(11, 18, 30, 0.92)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "12px",
                  padding: "20px",
                  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.6)",
                  fontFamily: "monospace",
                  color: "#fff",
                  overflowY: "auto",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#00c7d6",
                      letterSpacing: "0.1em",
                      fontWeight: 700,
                    }}
                  >
                    DATATAKE
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        background:
                          dt.cls === "ok"
                            ? "rgba(61, 214, 140, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                        color: statusColor,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        border: `1px solid ${statusColor}40`,
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: statusColor,
                        }}
                      />
                      {dt.status ? dt.status.toUpperCase() : "PROCESSING"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#8a96a8",
                        fontSize: "16px",
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "800",
                      letterSpacing: "0.05em",
                      fontFamily: "sans-serif",
                    }}
                  >
                    {dt.id}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#8a96a8",
                      marginTop: "2px",
                    }}
                  >
                    {dt.sat}
                  </div>
                </div>

                {/* Completion & Sensing KPI */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "38px",
                      fontWeight: "800",
                      fontFamily: "sans-serif",
                    }}
                  >
                    {percent}.0
                    <span style={{ fontSize: "20px", color: "#8a96a8" }}>
                      %
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#8a96a8" }}>
                    <div>SENSING</div>
                    <div style={{ color: "#fff", fontWeight: 700 }}>3m 25s</div>
                    <div style={{ marginTop: "4px" }}>MISSING</div>
                    <div style={{ color: "#fff", fontWeight: 700 }}>5m 40s</div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    marginBottom: "20px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    paddingBottom: "12px",
                  }}
                >
                  Mean across 8 expected product types · missing time summed
                  across types
                </div>

                {/* Details Table */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    fontSize: "11px",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#8a96a8" }}>SATELLITE ID</span>
                    <span style={{ fontWeight: 700 }}>{dt.sat}</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#8a96a8" }}>DATATAKE ID</span>
                    <span style={{ fontWeight: 700 }}>{dt.id}</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#8a96a8" }}>MODE</span>
                    <span style={{ fontWeight: 700 }}>IW · DV</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#8a96a8" }}>SWATH</span>
                    <span style={{ fontWeight: 700 }}>NA</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#8a96a8" }}>POLARISATION</span>
                    <span style={{ fontWeight: 700 }}>NA</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "4px",
                    }}
                  >
                    <span style={{ color: "#8a96a8" }}>
                      OBSERVATION TIME START
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {dt.startIso
                        ? dt.startIso.replace("T", " ") + "Z"
                        : "2026-07-16 09:33:10Z"}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#8a96a8" }}>
                      OBSERVATION TIME STOP
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      2026-07-16 09:36:35Z
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

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
                  background: "transparent",
                  border: "none",
                  padding: "0",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "sans-serif",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  textShadow: "0 0 4px #000000, 0 0 2px #000000",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00c7d6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 15a12 12 0 0 1 14-8" />
                  <path d="M12 5l-2 2" />
                  <line x1="9" y1="11" x2="15" y2="5" />
                  <path d="M12 15v6" />
                  <path d="M8 21h8" />
                </svg>
                <span>{station.name}</span>
              </div>
            );
          })}

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
