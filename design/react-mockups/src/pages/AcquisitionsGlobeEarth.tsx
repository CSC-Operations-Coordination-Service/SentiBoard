import { useState, useEffect, useRef } from "react";
import { PageHeader, Reveal, DescriptionModal } from "@/components/ui";
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

export default function AcquisitionsGlobeEarthPage() {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const overlaysRef = useRef<DataOverlays>({});

  const [selectedDataTake, setSelectedDataTake] = useState(0);
  const [satelliteFilter, setSatelliteFilter] = useState("*");
  const [dayFilter, setDayFilter] = useState("*");
  const [datatakeFilter, setDatatakeFilter] = useState("*");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const footprintMeshesRef = useRef<THREE.Object3D[]>([]);
  const [stationPositions, setStationPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean }>
  >({});

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

  const addDataOverlays = (scene: THREE.Scene) => {
    if (!scene) return;

    const overlayGroup = new THREE.Group();
    overlayGroup.name = "DataOverlays";
    scene.add(overlayGroup);

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

    footprintMeshesRef.current = [];
    ACQ_DATATAKES.slice(0, 5).forEach((datatake, idx) => {
      if (datatake.footprint && datatake.footprint.length >= 4) {
        const points: THREE.Vector3[] = [];
        const baseColor =
          datatake.cls === "ok"
            ? 0x3dd68c
            : datatake.cls === "warn"
              ? 0xf5b544
              : 0xff5c6c;

        datatake.footprint.forEach(([lon, lat]) => {
          const lat_rad = lat * D;
          const lon_rad = lon * D;
          points.push(
            new THREE.Vector3(
              Math.cos(lat_rad) * Math.sin(lon_rad),
              Math.sin(lat_rad),
              Math.cos(lat_rad) * Math.cos(lon_rad),
            ),
          );
        });

        const polygonGeometry = new THREE.BufferGeometry().setFromPoints(
          points,
        );
        const polygonMaterial = new THREE.MeshBasicMaterial({
          color: baseColor,
          opacity: 0.12,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: true,
        });
        const polygonMesh = new THREE.Mesh(polygonGeometry, polygonMaterial);
        polygonMesh.renderOrder = 14 + idx;
        overlayGroup.add(polygonMesh);

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: baseColor,
          opacity: 0.8,
          transparent: true,
          linewidth: 2,
          depthWrite: false,
          depthTest: true,
        });

        const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
        lineSegments.renderOrder = 18 + idx;
        lineSegments.userData = {
          datatakeId: datatake.id,
          isFootprint: true,
          baseColor,
        };
        overlayGroup.add(lineSegments);
        footprintMeshesRef.current.push(lineSegments);
      }
    });

    const orbits = [
      { inc: 98, omega: 30, col: 0x36d0e0, name: "S1C", pos: 0.2 },
      { inc: 98.6, omega: 150, col: 0x2e7df6, name: "S2A", pos: 0.5 },
      { inc: 98.2, omega: 255, col: 0x00c7d6, name: "S3B", pos: 0.75 },
    ];

    orbits.forEach((orbit, idx) => {
      const points: THREE.Vector3[] = [];
      let satPositionPoint: THREE.Vector3 | null = null;

      for (let d = 0; d <= 360; d += 5) {
        const angle = (d * Math.PI) / 180;
        const inc = orbit.inc * D;
        const om = orbit.omega * D;
        const lat = Math.asin(Math.sin(inc) * Math.sin(angle));
        const lon =
          om + Math.atan2(Math.cos(inc) * Math.sin(angle), Math.cos(angle));

        const pt = new THREE.Vector3(
          Math.cos(lat) * Math.sin(lon),
          Math.sin(lat),
          Math.cos(lat) * Math.cos(lon),
        );
        points.push(pt);

        if (d === Math.floor(360 * orbit.pos)) satPositionPoint = pt;
      }

      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: orbit.col,
        opacity: 0.3,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      });

      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      orbitLine.renderOrder = 10 + idx;
      overlayGroup.add(orbitLine);

      if (satPositionPoint) {
        const satMarkerGeometry = new THREE.SphereGeometry(0.012, 8, 8);
        const satMarkerMaterial = new THREE.MeshBasicMaterial({
          color: orbit.col,
          depthWrite: false,
          depthTest: true,
        });
        const satMarker = new THREE.Mesh(satMarkerGeometry, satMarkerMaterial);
        satMarker.position.copy(satPositionPoint);
        satMarker.renderOrder = 25;
        overlayGroup.add(satMarker);
      }
    });

    overlaysRef.current = {
      footprints: footprintMeshesRef.current,
      stations: overlayGroup,
    };
  };

  useEffect(() => {
    if (!footprintMeshesRef.current) return;
    footprintMeshesRef.current.forEach((mesh, idx) => {
      const isSelected = idx === selectedDataTake;
      const lineSegments = mesh as any as THREE.LineSegments;
      const material = lineSegments.material as THREE.LineBasicMaterial;
      if (isSelected) {
        material.color.set(0x00c7d6);
        material.opacity = 1.0;
      } else {
        const baseColor = lineSegments.userData?.baseColor || 0x3dd68c;
        material.color.set(baseColor);
        material.opacity = 0.7;
      }
    });
  }, [selectedDataTake]);

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

    addDataOverlays(scene);

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
    const updateStationPositions = () => {
      if (!cameraRef.current || !rendererRef.current) return;

      const camera = cameraRef.current as THREE.PerspectiveCamera;
      const renderer = rendererRef.current;
      const positions: Record<
        string,
        { x: number; y: number; visible: boolean }
      > = {};

      STATIONS.forEach((station) => {
        const lat = station.lat * D;
        const lon = station.lon * D;

        const x = Math.cos(lat) * Math.sin(lon);
        const y = Math.sin(lat);
        const z = Math.cos(lat) * Math.cos(lon);

        const worldPos = new THREE.Vector3(x, y, z);
        const camPos = camera.position.clone();

        const isVisible =
          worldPos.clone().normalize().dot(camPos.normalize()) > 0.15;

        const vector = worldPos.clone().project(camera);
        const canvas = renderer.domElement;
        const x2d = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
        const y2d = (-vector.y * 0.5 + 0.5) * canvas.clientHeight;

        positions[station.name] = { x: x2d, y: y2d, visible: isVisible };
      });

      setStationPositions(positions);
    };

    const interval = setInterval(updateStationPositions, 30);
    return () => clearInterval(interval);
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
      <style>{`
        @keyframes ed-slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ed-slide {
          animation: ed-slide 45s linear infinite;
        }
      `}</style>

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
          15 – 16 JULY 2026
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
          background: "transparent",
          width: "100%",
        }}
      >
        {/* SLIDING BACKGROUND TRACK DIRECTLY BEHIND THE GLOBE */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <div className="flex h-full w-max animate-ed-slide">
            <img
              src="/assets/img/nebula.jpg"
              className="h-full w-auto object-cover"
              alt=""
            />
            <img
              src="/assets/img/nebula.jpg"
              className="h-full w-auto object-cover"
              alt=""
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at center, rgba(2,4,9,0.1) 0%, rgba(2,4,9,0.85) 100%)",
            }}
          />
        </div>

        {/* THREE.JS CANVAS */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            height: "100%",
          }}
        >
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
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              color: "#fff",
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
                const currentDistance = cameraRef.current.position.length();
                const newDistance = Math.min(6, currentDistance * 1.15);
                cameraRef.current.position.copy(
                  direction.multiplyScalar(newDistance),
                );
                cameraRef.current.lookAt(0, 0, 0);
              }
            }}
            style={{
              width: "36px",
              height: "36px",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              color: "#fff",
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
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "14px",
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
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  color: "#fff",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                <span>📡 {station.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
