import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polyline,
  Polygon,
  Marker,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import {
  Waves,
  Satellite,
  Wind,
  Ship,
  AlertTriangle,
  ChevronRight,
  FolderOpen,
  ArrowRight,
  Activity,
  Navigation,
  ArrowLeft,
} from "lucide-react";

import "leaflet/dist/leaflet.css";
import "./App.css";


/* -------------------------------------------------------
   INCIDENT DATA
------------------------------------------------------- */

const incidents = [
  {
    id: "INC-042",
    location: "Arabian Sea",
    lat: 17.8,
    lng: 65.0,
    confidence: 94,
    severity: "HIGH",
    time: "14:12 UTC",
    area: "4.1 km²",
    age: "1.9 hrs",
    vessel: "MT VARUNA-17",
    mmsi: "419123456",
    vesselType: "Oil Tanker",
    attribution: 87,
    spatial: 92,
    temporal: 84,
    trajectory: 91,
    heading: 81,
    behavioral: 79,
    wind: "5.8 m/s SW",
    current: "0.8 kn WSW",

    vesselPosition: [18.65, 62.15],

    aisTrack: [
      [18.75, 61.9],
      [18.6, 62.3],
      [18.4, 62.8],
      [18.2, 63.4],
      [18.05, 64.0],
      [17.9, 64.55],
      [17.8, 65.0],
    ],

    forecast: [
      [17.8, 65.0],
      [17.65, 65.5],
      [17.4, 66.1],
      [17.0, 66.8],
      [16.5, 67.5],
      [15.9, 68.2],
    ],

    spillPolygon: [
      [18.03, 64.72],
      [18.15, 64.94],
      [18.03, 65.18],
      [17.82, 65.30],
      [17.62, 65.10],
      [17.58, 64.82],
      [17.75, 64.65],
    ],
  },

  {
    id: "INC-041",
    location: "Bay of Bengal",
    lat: 15.2,
    lng: 88.5,
    confidence: 82,
    severity: "MED",
    time: "11:47 UTC",
    area: "2.8 km²",
    age: "2.8 hrs",
    vessel: "MT EASTERN DAWN",
    mmsi: "419654321",
    vesselType: "Product Tanker",
    attribution: 73,
    spatial: 78,
    temporal: 71,
    trajectory: 76,
    heading: 69,
    behavioral: 64,
    wind: "6.4 m/s SW",
    current: "0.6 kn WSW",

    vesselPosition: [15.0, 87.25],

    aisTrack: [
      [15.65, 86.0],
      [15.55, 86.35],
      [15.4, 86.65],
      [15.3, 87.0],
      [15.2, 87.5],
      [15.2, 88.5],
    ],

    forecast: [
      [15.2, 88.5],
      [15.0, 89.0],
      [14.75, 89.6],
      [14.35, 90.2],
      [13.9, 90.8],
      [13.4, 91.4],
    ],

    spillPolygon: [
      [15.42, 88.28],
      [15.50, 88.52],
      [15.30, 88.76],
      [15.08, 88.82],
      [14.94, 88.55],
      [15.02, 88.30],
      [15.23, 88.20],
    ],
  },

  {
    id: "INC-040",
    location: "Gulf of Oman",
    lat: 24.2,
    lng: 58.1,
    confidence: 76,
    severity: "LOW",
    time: "08:23 UTC",
    area: "1.7 km²",
    age: "1.9 hrs",
    vessel: "MT VARUNA-17",
    mmsi: "419123456",
    vesselType: "Oil Tanker",
    attribution: 64,
    spatial: 71,
    temporal: 63,
    trajectory: 68,
    heading: 58,
    behavioral: 55,
    wind: "5.1 m/s SW",
    current: "0.5 kn W",

    vesselPosition: [24.7, 57.1],

    aisTrack: [
      [25.0, 56.4],
      [24.85, 56.7],
      [24.65, 57.0],
      [24.45, 57.4],
      [24.2, 58.1],
    ],

    forecast: [
      [24.2, 58.1],
      [23.95, 58.5],
      [23.65, 59.0],
      [23.3, 59.5],
      [22.9, 60.0],
    ],

    spillPolygon: [
      [24.42, 57.85],
      [24.50, 58.10],
      [24.34, 58.32],
      [24.08, 58.30],
      [23.96, 58.05],
      [24.08, 57.82],
    ],
  },

  {
    id: "INC-039",
    location: "South China Sea",
    lat: 10.8,
    lng: 113.4,
    confidence: 61,
    severity: "LOW",
    time: "02:10 UTC",
    area: "1.2 km²",
    age: "3.6 hrs",
    vessel: "MT SILVER SEA",
    mmsi: "566221334",
    vesselType: "Bulk Carrier",
    attribution: 51,
    spatial: 58,
    temporal: 52,
    trajectory: 55,
    heading: 49,
    behavioral: 43,
    wind: "4.8 m/s E",
    current: "0.7 kn E",

    vesselPosition: [11.7, 112.0],

    aisTrack: [
      [12.1, 111.1],
      [11.9, 111.4],
      [11.7, 111.7],
      [11.35, 112.1],
      [11.05, 112.7],
      [10.8, 113.4],
    ],

    forecast: [
      [10.8, 113.4],
      [10.6, 114.0],
      [10.4, 114.7],
      [10.2, 115.4],
      [9.9, 116.0],
    ],

    spillPolygon: [
      [11.00, 113.20],
      [11.05, 113.45],
      [10.90, 113.65],
      [10.65, 113.60],
      [10.55, 113.35],
      [10.68, 113.12],
    ],
  },
];

/* -------------------------------------------------------
   MAP CONTROLLER
------------------------------------------------------- */

function MapController({ incident }) {
  const map = useMap();

  useEffect(() => {
    if (!incident) return;

    map.flyTo(
      [incident.lat, incident.lng],
      7,
      {
        duration: 0.9,
        easeLinearity: 0.25,
      }
    );
  }, [incident, map]);

  return null;
}

/* -------------------------------------------------------
   MAP LABEL ICONS
------------------------------------------------------- */

function createSpillIcon(incident) {
  return L.divIcon({
    className: "spill-label-icon",
    html: `
      <div class="spill-label">
        <div class="spill-label-kicker">
          <span class="spill-warning">△</span>
          OIL SLICK DETECTION
        </div>
        <div class="spill-label-area">${incident.area}</div>
        <div class="spill-label-time">
          Detected ${incident.time}
        </div>
      </div>
    `,
    iconSize: [150, 72],
    iconAnchor: [75, 36],
  });
}

function createSourceIcon(incident) {
  return L.divIcon({
    className: "source-label-icon",
    html: `
      <div class="source-label">
        <div class="source-kicker">PROBABLE SOURCE AREA</div>
        <div class="source-row">
          <span class="source-dot"></span>
          <span>${incident.vessel}</span>
          <strong>${incident.attribution}%</strong>
        </div>
      </div>
    `,
    iconSize: [175, 48],
    iconAnchor: [87, 24],
  });
}

/* -------------------------------------------------------
   APP
------------------------------------------------------- */

export default function App() {
  const [selectedIncident, setSelectedIncident] = useState(incidents[0]);
  const [mapMode, setMapMode] = useState("chart");
  const [activeTab, setActiveTab] = useState("detection");
  const [showEvidence, setShowEvidence] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);

  const incident = selectedIncident;

  const selectIncident = (item) => {
    setSelectedIncident(item);
    setActiveTab("detection");
    setShowEvidence(false);
    setShowImpact(false);
    setTimelineStep(0);
  };

  const mapCenter = useMemo(
    () => [incident.lat, incident.lng],
    [incident]
  );

  if (showImpact) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Waves size={17} />
            </div>

            <div>
              <div className="brand-name">
                OIL<span>SENTINEL</span>
              </div>
              <div className="brand-subtitle">
                MARITIME ENVIRONMENTAL INTELLIGENCE
              </div>
            </div>
          </div>

          <div className="system-status">
            <span className="live-dot" />
            <span>LIVE</span>
            <i />
            <span>UTC</span>
            <span>14:32:18</span>
          </div>

          <div className="top-actions">
            <span>OPERATIONS</span>
            <button>
              <Activity size={15} />
            </button>
          </div>
        </header>

        <ImpactView
          incident={incident}
          onBack={() => setShowImpact(false)}
        />
      </div>
    );
  }

  return (
    <div className="app">

      {/* ------------------------------------------------
          TOP BAR
      ------------------------------------------------ */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Waves size={17} />
          </div>

          <div>
            <div className="brand-name">
              OIL<span>SENTINEL</span>
            </div>

            <div className="brand-subtitle">
              MARITIME ENVIRONMENTAL INTELLIGENCE
            </div>
          </div>
        </div>

        <div className="system-status">
          <span className="live-dot" />
          <span>LIVE</span>
          <i />
          <span>UTC</span>
          <span>14:32:18</span>
          <i />
          <span>02 JUN 2025</span>
        </div>

        <div className="top-actions">
          <span>OPERATIONS</span>

          <button>
            <Activity size={15} />
          </button>

          <button>
            <span className="hamburger">☰</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------
          MAIN WORKSPACE
      ------------------------------------------------ */}

      <main className="workspace">

        {/* LEFT RAIL */}

        <aside className="incident-rail">

          <div className="rail-heading">
            <span>ACTIVE INCIDENTS</span>
            <strong>{incidents.length}</strong>
          </div>

          <div className="incident-list">

            {incidents.map((item) => (
              <button
                key={item.id}
                className={`incident-item ${
                  incident.id === item.id ? "selected" : ""
                }`}
                onClick={() => selectIncident(item)}
              >
                <div className="incident-top">

                  <span
                    className={`severity-dot ${item.severity}`}
                  />

                  <span className="incident-id">
                    {item.id}
                  </span>

                  <span
                    className={`severity ${item.severity}`}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="incident-location">
                  {item.location}
                </div>

                <div className="incident-meta">
                  <span>Detected {item.time}</span>
                  <strong>{item.confidence}%</strong>
                </div>
              </button>
            ))}

          </div>

          <div className="data-streams">

            <div className="rail-heading">
              <span>DATA STREAMS</span>
            </div>

            <DataStream
              icon={<Satellite size={13} />}
              name="SENTINEL-1 SAR"
              status="LIVE"
            />

            <DataStream
              icon={<Satellite size={13} />}
              name="SENTINEL-2 OPTICAL"
              status="LIVE"
            />

            <DataStream
              icon={<Navigation size={13} />}
              name="AIS"
              status="LIVE"
            />

            <DataStream
              icon={<Wind size={13} />}
              name="METEO (ECMWF)"
              status="LIVE"
            />

            <DataStream
              icon={<Waves size={13} />}
              name="OCEAN CURRENT"
              status="LIVE"
            />

            <DataStream
              icon={<Wind size={13} />}
              name="WIND FIELD"
              status="LIVE"
            />

          </div>

        </aside>

        {/* MAP */}

        <section className="map-area">

          <MapContainer
            center={mapCenter}
            zoom={7}
            minZoom={4}
            maxZoom={12}
            maxBounds={[
              [-60, -180],
              [80, 180],
            ]}
            maxBoundsViscosity={1}
            worldCopyJump={false}
            zoomControl={false}
            attributionControl={true}
          >

            <MapController incident={incident} />

            {/* NO CARTO.
                NO API KEY.
                ESRI PUBLIC TILES.
            */}

            {mapMode === "chart" ? (
              <TileLayer
                attribution="&copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              />
            ) : (
              <TileLayer
                attribution="&copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            )}

            {/* ------------------------------------------
                SELECTED SPILL
            ------------------------------------------ */}

            <Polygon
              positions={incident.spillPolygon}
              pathOptions={{
                color: "#ffae19",
                weight: 2,
                opacity: 1,
                fillColor: "#ff8c00",
                fillOpacity:
                  mapMode === "satellite" ? 0.25 : 0.16,
                dashArray: "4 3",
              }}
            />

            <Circle
              center={[incident.lat, incident.lng]}
              radius={24000}
              pathOptions={{
                color: "#ffae19",
                weight: 1,
                opacity: 0.5,
                fillColor: "#ffae19",
                fillOpacity: 0.05,
              }}
            />

            <CircleMarker
              center={[incident.lat, incident.lng]}
              radius={8}
              pathOptions={{
                color: "#ffbd38",
                weight: 2,
                fillColor: "#ff8c00",
                fillOpacity: 1,
              }}
            />

            {/* ACTUAL SPILL LABEL — TIED TO SPILL */}

            <Marker
              position={[incident.lat, incident.lng]}
              icon={createSpillIcon(incident)}
              interactive={false}
            />

            {/* PROBABLE SOURCE LABEL — TIED TO SOURCE */}

            <Marker
              position={incident.vesselPosition}
              icon={createSourceIcon(incident)}
              interactive={false}
            />

            {/* ------------------------------------------
                AIS TRACK
            ------------------------------------------ */}

            <Polyline
              positions={incident.aisTrack}
              pathOptions={{
                color: "#49dce9",
                weight: 2,
                opacity: 0.9,
                dashArray: "3 7",
              }}
            />

            {/* ------------------------------------------
                PREDICTED DRIFT
            ------------------------------------------ */}

            <Polyline
              positions={incident.forecast}
              pathOptions={{
                color: "#ffad19",
                weight: 2,
                opacity: 0.95,
                dashArray: "8 8",
              }}
            />

            {/* FORECAST ENVELOPE */}

            <Polygon
              positions={incident.forecast.map(
                ([lat, lng], index) => [
                  lat + 0.35 + index * 0.04,
                  lng - 0.28,
                ]
              )}
              pathOptions={{
                color: "#ffad19",
                weight: 1,
                opacity: 0.25,
                fillColor: "#ffad19",
                fillOpacity: 0.025,
                dashArray: "5 7",
              }}
            />

            {/* SOURCE / VESSEL */}

            <CircleMarker
              center={incident.vesselPosition}
              radius={7}
              pathOptions={{
                color: "#5be3ec",
                weight: 2,
                fillColor: "#061820",
                fillOpacity: 1,
              }}
            />

            {/* OTHER INCIDENTS */}

            {incidents
              .filter((item) => item.id !== incident.id)
              .map((item) => (
                <CircleMarker
                  key={item.id}
                  center={[item.lat, item.lng]}
                  radius={5}
                  eventHandlers={{
                    click: () => selectIncident(item),
                  }}
                  pathOptions={{
                    color:
                      item.severity === "HIGH"
                        ? "#ff5f50"
                        : item.severity === "MED"
                        ? "#ffbd38"
                        : "#50d8c0",
                    weight: 1.5,
                    fillOpacity: 0.95,
                  }}
                />
              ))}
          </MapContainer>

          {/* SELECTED INCIDENT */}

          <div className="map-incident-label">
            <div className="label-kicker">
              SELECTED INCIDENT
            </div>

            <div className="label-id">
              {incident.id}
            </div>

            <div className="label-coords">
              {incident.lat.toFixed(3)}° N&nbsp;&nbsp;
              {incident.lng.toFixed(3)}° E
            </div>
          </div>

          {/* ONLY THE EXISTING CHART / SATELLITE UI */}

          <div className="map-controls">

            <div className="map-switch">

              <button
                className={
                  mapMode === "chart" ? "active" : ""
                }
                onClick={() => setMapMode("chart")}
              >
                <Navigation size={13} />
                CHART
              </button>

              <button
                className={
                  mapMode === "satellite"
                    ? "active"
                    : ""
                }
                onClick={() => setMapMode("satellite")}
              >
                <Satellite size={13} />
                SATELLITE
              </button>

            </div>

          </div>

          {/* WIND */}

          <div className="wind-indicator">
            <Wind size={14} />
            <span>SW</span>
            <strong>→</strong>
            <span>{incident.wind.replace(" SW", "")}</span>
          </div>

          {/* LEGEND */}

          <div className="map-legend">

            <LegendLine
              type="oil"
              label="OIL SLICK"
            />

            <LegendLine
              type="ais"
              label="AIS TRACK"
            />

            <LegendLine
              type="forecast"
              label="FORECAST"
            />

            <LegendLine
              type="source"
              label="SOURCE AREA"
            />

          </div>

        </section>
      </main>

      {/* ------------------------------------------------
          BOTTOM INTELLIGENCE PANEL
      ------------------------------------------------ */}

      <section className="intel-panel">

        <div className="intel-header">

          <div className="active-incident">

            <div className="alert-icon">
              <AlertTriangle size={17} />
            </div>

            <div>

              <div className="intel-kicker">
                ACTIVE INCIDENT
              </div>

              <div className="intel-title-row">

                <strong>{incident.id}</strong>

                <span>{incident.location}</span>

                <i />

                <span>{incident.time}</span>

              </div>

            </div>
          </div>

          <div className="confidence">

            <span>DETECTION CONFIDENCE</span>

            <strong>{incident.confidence}%</strong>

          </div>

        </div>

        {/* RELATIONSHIP */}

        <div className="relationship">

          <RelationshipNode
            active
            label="SPILL"
          />

          <ChevronRight />

          <RelationshipNode label="SOURCE" />

          <ChevronRight />

          <RelationshipNode label="VESSEL" />

          <ChevronRight />

          <RelationshipNode label="TRAJECTORY" />

          <ChevronRight />

          <RelationshipNode label="IMPACT" />

        </div>

        {/* TABS */}

        <div className="intel-tabs">

          {[
            "detection",
            "vessels",
            "forecast",
            "impact",
          ].map((tab) => (

            <button
              key={tab}
              className={
                activeTab === tab ? "active" : ""
              }
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>

          ))}

        </div>

        {/* CONTENT */}

        <div className="intel-content">

          {activeTab === "detection" && (
            <DetectionPanel
              incident={incident}
              onEvidence={() =>
                setShowEvidence(true)
              }
            />
          )}

          {activeTab === "vessels" && (
            <VesselPanel
              incident={incident}
              onEvidence={() =>
                setShowEvidence(true)
              }
            />
          )}

          {activeTab === "forecast" && (
            <ForecastPanel
              incident={incident}
              timelineStep={timelineStep}
              setTimelineStep={setTimelineStep}
            />
          )}

          {activeTab === "impact" && (
            <ImpactPanel
              incident={incident}
              onOpen={() => setShowImpact(true)}
            />
          )}

        </div>

        {/* TIMELINE */}

        <Timeline
          incident={incident}
          timelineStep={timelineStep}
          setTimelineStep={setTimelineStep}
          onImpact={() => setShowImpact(true)}
        />

      </section>

      {/* EVIDENCE MODAL */}

      {showEvidence && (
        <EvidenceModal
          incident={incident}
          onClose={() => setShowEvidence(false)}
        />
      )}

    </div>
  );
}

/* -------------------------------------------------------
   COMPONENTS
------------------------------------------------------- */

function DataStream({ icon, name, status }) {
  return (
    <div className="data-stream">
      {icon}
      <span>{name}</span>
      <strong>{status}</strong>
    </div>
  );
}

function RelationshipNode({ label, active }) {
  return (
    <div
      className={`relationship-node ${
        active ? "active" : ""
      }`}
    >
      <span className="relationship-dot" />
      {label}
    </div>
  );
}

function LegendLine({ type, label }) {
  return (
    <div className="legend-line">
      <span className={`legend-symbol ${type}`} />
      <span>{label}</span>
    </div>
  );
}

/* -------------------------------------------------------
   DETECTION
------------------------------------------------------- */

function DetectionPanel({ incident, onEvidence }) {
  return (
    <div className="detection-layout">

      <Metric
        label="DETECTED"
        value={incident.time}
      />

      <Metric
        label="SPILL AREA"
        value={incident.area}
      />

      <Metric
        label="EST. AGE"
        value={incident.age}
      />

      <Metric
        label="WIND"
        value={incident.wind}
      />

      <div className="match-vessel">

        <span className="metric-label">
          TOP VESSEL MATCH
        </span>

        <div className="vessel-inline">

          <div className="ship-icon">
            <Ship size={19} />
          </div>

          <div>
            <strong>{incident.vessel}</strong>
            <small>
              MMSI {incident.mmsi} · {incident.vesselType}
            </small>
          </div>

        </div>

      </div>

      <div className="attribution-box">
        <span>ATTRIBUTION</span>
        <strong>{incident.attribution}%</strong>
      </div>

      <MatchBars incident={incident} />

      <EvidenceButton onClick={onEvidence} />

    </div>
  );
}

/* -------------------------------------------------------
   VESSELS
------------------------------------------------------- */

function VesselPanel({ incident, onEvidence }) {
  return (
    <div className="vessel-panel">

      <div className="vessel-main">

        <div className="ship-icon large">
          <Ship size={21} />
        </div>

        <div>
          <div className="vessel-name">
            {incident.vessel}
          </div>

          <div className="vessel-sub">
            MMSI {incident.mmsi} · {incident.vesselType}
          </div>
        </div>

        <div className="attribution-box">
          <span>ATTRIBUTION</span>
          <strong>{incident.attribution}%</strong>
        </div>

      </div>

      <MatchBars incident={incident} />

      <EvidenceButton onClick={onEvidence} />

    </div>
  );
}

/* -------------------------------------------------------
   MATCH BARS
------------------------------------------------------- */

function MatchBars({ incident }) {
  const values = [
    ["Spatial Match", incident.spatial],
    ["Temporal Match", incident.temporal],
    ["Trajectory Match", incident.trajectory],
    ["Heading Match", incident.heading],
    ["Behavioral Match", incident.behavioral],
  ];

  return (
    <div className="match-bars">

      {values.map(([label, value]) => (

        <div className="match-row" key={label}>

          <span>{label}</span>

          <div className="match-track">
            <div
              className="match-fill"
              style={{
                width: `${value}%`,
              }}
            />
          </div>

          <strong>{value}%</strong>

        </div>

      ))}

    </div>
  );
}

/* -------------------------------------------------------
   FORECAST
------------------------------------------------------- */

function ForecastPanel({
  incident,
  timelineStep,
  setTimelineStep,
}) {
  const stages = [
    ["NOW", incident.time],
    ["+6H", "20:12 UTC"],
    ["+12H", "02:12 UTC"],
    ["+24H", "14:12 UTC"],
    ["+48H", "14:12 UTC"],
  ];

  return (
    <div className="forecast-panel">

      <div className="forecast-summary">

        <div>
          <span className="metric-label">
            FORECAST MODEL
          </span>
          <strong>GNOME</strong>
        </div>

        <div>
          <span className="metric-label">
            CURRENT
          </span>
          <strong>{incident.current}</strong>
        </div>

        <div>
          <span className="metric-label">
            WIND
          </span>
          <strong>{incident.wind}</strong>
        </div>

      </div>

      <div className="forecast-timeline">

        {stages.map(([label, time], index) => (

          <button
            key={label}
            className={
              timelineStep === index
                ? "selected"
                : ""
            }
            onClick={() =>
              setTimelineStep(index)
            }
          >

            <span>{label}</span>
            <small>{time}</small>

          </button>

        ))}

      </div>

      <div className="forecast-status">

        <span>
          PREDICTED DRIFT
        </span>

        <strong>
          {timelineStep === 0
            ? "CURRENT POSITION"
            : `FORECAST +${timelineStep === 1
              ? 6
              : timelineStep === 2
              ? 12
              : timelineStep === 3
              ? 24
              : 48}H`}
        </strong>

      </div>

    </div>
  );
}

/* -------------------------------------------------------
   IMPACT
------------------------------------------------------- */

function ImpactPanel({ incident, onOpen }) {
  return (
    <div className="impact-panel">

      <ImpactCard
        icon="coast"
        label="COASTLINE"
        risk="MEDIUM RISK"
        time="+38H"
      />

      <ImpactCard
        icon="fish"
        label="FISHING ZONE"
        risk="HIGH RISK"
        time="+26H"
      />

      <ImpactCard
        icon="port"
        label="PORT FACILITY"
        risk="LOW RISK"
        time="+51H"
      />

      <button
        className="impact-open"
        onClick={onOpen}
      >
        <Activity size={15} />
        IMPACT ASSESSMENT
        <ArrowRight size={15} />
      </button>

    </div>
  );
}

function ImpactCard({
  icon,
  label,
  risk,
  time,
}) {
  return (
    <div className="impact-card">

      <div className={`impact-icon ${icon}`}>
        {icon === "coast" && (
          <AlertTriangle size={17} />
        )}

        {icon === "fish" && (
          <Waves size={17} />
        )}

        {icon === "port" && (
          <Navigation size={17} />
        )}
      </div>

      <div>
        <span>{label}</span>
        <strong>{risk}</strong>
      </div>

      <small>{time}</small>

    </div>
  );
}

/* -------------------------------------------------------
   TIMELINE
------------------------------------------------------- */

function Timeline({
  incident,
  timelineStep,
  setTimelineStep,
  onImpact,
}) {
  const times = [
    [0, "NOW", incident.time],
    [1, "+6H", "20:12 UTC"],
    [2, "+12H", "02:12 UTC"],
    [3, "+24H", "14:12 UTC"],
    [4, "+48H", "14:12 UTC"],
  ];

  return (
    <div className="event-timeline">

      <div className="timeline-label">
        <Activity size={12} />
        EVENT TIMELINE
      </div>

      <div className="timeline-controls">

        <button
          onClick={() =>
            setTimelineStep(
              Math.max(0, timelineStep - 1)
            )
          }
        >
          <ArrowLeft size={14} />
        </button>

      </div>

      <div className="timeline">

        <div className="timeline-base" />

        <div
          className="timeline-progress"
          style={{
            width: `${timelineStep * 25}%`,
          }}
        />

        {times.map(([index, label, time]) => (

          <button
            className={`timeline-point ${
              timelineStep === index
                ? "active"
                : ""
            }`}
            key={label}
            onClick={() => setTimelineStep(index)}
          >

            <span />

            <strong>{label}</strong>

            <small>{time}</small>

          </button>

        ))}

      </div>

      <div className="forecast-model">

        <span>FORECAST MODEL</span>
        <strong>GNOME</strong>
        <small>
          Run 02 Jun 2025 14:00 UTC
        </small>

      </div>

      <button
        className="impact-assessment-button"
        onClick={onImpact}
      >
        <Activity size={15} />
        IMPACT ASSESSMENT
        <ArrowRight size={15} />
      </button>

    </div>
  );
}

/* -------------------------------------------------------
   EVIDENCE
------------------------------------------------------- */

function EvidenceButton({ onClick }) {
  return (
    <button
      className="evidence-button"
      onClick={onClick}
    >
      <FolderOpen size={15} />
      VIEW EVIDENCE
      <ArrowRight size={15} />
    </button>
  );
}

function EvidenceModal({ incident, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >

      <div
        className="evidence-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <div className="modal-header">

          <div>
            <span>INVESTIGATION EVIDENCE</span>
            <h2>{incident.id}</h2>
          </div>

          <button onClick={onClose}>
            ×
          </button>

        </div>

        <div className="evidence-grid">

          <EvidenceItem
            label="SATELLITE SOURCE"
            value="Sentinel-1 SAR"
            status="VERIFIED"
          />

          <EvidenceItem
            label="DETECTION TIME"
            value={incident.time}
            status="MATCHED"
          />

          <EvidenceItem
            label="SPILL AREA"
            value={incident.area}
            status="DETECTED"
          />

          <EvidenceItem
            label="TOP AIS CANDIDATE"
            value={incident.vessel}
            status={`${incident.attribution}% MATCH`}
          />

        </div>

        <div className="evidence-note">

          <AlertTriangle size={16} />

          <div>
            <strong>
              Attribution is probabilistic.
            </strong>

            <p>
              Vessel ranking combines spatial,
              temporal, trajectory, heading and
              behavioural evidence. It does not
              constitute proof of responsibility.
            </p>
          </div>

        </div>

        <button
          className="modal-close"
          onClick={onClose}
        >
          CLOSE EVIDENCE
        </button>

      </div>
    </div>
  );
}

function EvidenceItem({
  label,
  value,
  status,
}) {
  return (
    <div className="evidence-item">

      <span>{label}</span>

      <strong>{value}</strong>

      <small>{status}</small>

    </div>
  );
}

/* -------------------------------------------------------
   FULL IMPACT VIEW
------------------------------------------------------- */

function ImpactView({ incident, onBack }) {
  return (
    <div className="impact-view">

      <div className="impact-view-header">

        <button
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={15} />
          BACK TO INCIDENT
        </button>

        <div>
          <span>IMPACT ASSESSMENT</span>
          <strong>
            {incident.id} · {incident.location}
          </strong>
        </div>

        <div className="impact-confidence">
          <span>DETECTION CONFIDENCE</span>
          <strong>{incident.confidence}%</strong>
        </div>

      </div>

      <div className="impact-overview">

        <ImpactCard
          icon="coast"
          label="COASTLINE"
          risk="MEDIUM RISK"
          time="+38H"
        />

        <ImpactCard
          icon="fish"
          label="FISHING ZONE"
          risk="HIGH RISK"
          time="+26H"
        />

        <ImpactCard
          icon="port"
          label="PORT FACILITY"
          risk="LOW RISK"
          time="+51H"
        />

      </div>

      <div className="impact-analysis">

        <div className="impact-section">

          <span className="metric-label">
            PREDICTED IMPACT
          </span>

          <h2>
            Fishing zone exposure
          </h2>

          <p>
            Current drift modelling indicates
            elevated probability of oil reaching
            the identified fishing zone within
            approximately 26 hours.
          </p>

        </div>

        <div className="impact-section">

          <span className="metric-label">
            RESPONSE PRIORITY
          </span>

          <div className="priority-critical">
            HIGH
          </div>

          <p>
            Prioritise containment planning for
            the forecast corridor and monitor
            coastal exposure.
          </p>

        </div>

      </div>

      <div className="impact-bottom">

        <span>
          FORECAST MODEL
        </span>

        <strong>GNOME</strong>

        <span>
          RUN 02 JUN 2025 14:00 UTC
        </span>

      </div>

    </div>
  );
}

/* -------------------------------------------------------
   METRIC
------------------------------------------------------- */

function Metric({ label, value }) {
  return (
    <div className="metric">

      <span className="metric-label">
        {label}
      </span>

      <strong>{value}</strong>

    </div>
  );
}
