import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import {
  Radio,
  Satellite,
  Waves,
  Wind,
  Ship,
  AlertTriangle,
  ChevronRight,
  X,
  Layers,
  Navigation,
  Crosshair,
  Activity,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./App.css";

const incidents = [
  {
    id: "INC-042",
    location: "Arabian Sea",
    lat: 17.8,
    lng: 65.0,
    confidence: 91,
    severity: "HIGH",
    time: "14:12 UTC",
    area: "14.7 km²",
    age: "4.2 hrs",
    vessel: "MT VARUNA-17",
    mmsi: "419123456",
    attribution: 87,
    spatial: 92,
    temporal: 84,
    trajectory: 91,
    heading: 81,
  },
  {
    id: "INC-041",
    location: "Bay of Bengal",
    lat: 15.2,
    lng: 88.5,
    confidence: 84,
    severity: "MED",
    time: "11:47 UTC",
    area: "8.2 km²",
    age: "2.8 hrs",
    vessel: "MT EASTERN DAWN",
    mmsi: "419654321",
    attribution: 73,
    spatial: 78,
    temporal: 71,
    trajectory: 76,
    heading: 69,
  },
  {
    id: "INC-040",
    location: "Gulf of Oman",
    lat: 24.2,
    lng: 58.1,
    confidence: 76,
    severity: "LOW",
    time: "08:23 UTC",
    area: "4.1 km²",
    age: "1.9 hrs",
    vessel: "MT VARUNA-17",
    mmsi: "419123456",
    attribution: 64,
    spatial: 71,
    temporal: 63,
    trajectory: 68,
    heading: 58,
  },
];

const vesselTrack = [
  [18.7, 62.2],
  [18.5, 62.8],
  [18.3, 63.4],
  [18.1, 64.0],
  [18.0, 64.5],
  [17.8, 65.0],
];

const predictedTrack = [
  [17.8, 65.0],
  [17.6, 65.5],
  [17.3, 66.1],
  [16.9, 66.8],
  [16.4, 67.5],
  [15.8, 68.2],
];

function MapController({ incident }) {
  const map = useMap();

  useEffect(() => {
    if (!incident) return;

    map.flyTo([incident.lat, incident.lng], 7, {
      duration: 1.2,
    });
  }, [incident, map]);

  return null;
}

function App() {
  const [selectedIncident, setSelectedIncident] = useState(incidents[0]);
  const [mapMode, setMapMode] = useState("chart");
  const [activeTab, setActiveTab] = useState("detection");
  const [showLayers, setShowLayers] = useState(false);

  const selectIncident = (incident) => {
    setSelectedIncident(incident);
    setActiveTab("detection");
  };

  return (
    <div className="app">
      {/* TOP BAR */}
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
          <button onClick={() => setShowLayers(!showLayers)}>
            <Layers size={15} />
          </button>
        </div>
      </header>

      <main className="workspace">
        {/* LEFT INCIDENT RAIL */}
        <aside className="incident-rail">
          <div className="rail-heading">
            <span>ACTIVE INCIDENTS</span>
            <strong>03</strong>
          </div>

          <div className="incident-list">
            {incidents.map((incident) => (
              <button
                key={incident.id}
                className={`incident-item ${
                  selectedIncident.id === incident.id ? "selected" : ""
                }`}
                onClick={() => selectIncident(incident)}
              >
                <div className="incident-top">
                  <span className={`severity-dot ${incident.severity}`} />
                  <span className="incident-id">{incident.id}</span>
                  <span className={`severity ${incident.severity}`}>
                    {incident.severity}
                  </span>
                </div>

                <div className="incident-location">
                  {incident.location}
                </div>

                <div className="incident-meta">
                  <span>{incident.time}</span>
                  <span>{incident.confidence}% CONF.</span>
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
              icon={<Navigation size={13} />}
              name="AIS"
              status="LIVE"
            />

            <DataStream
              icon={<Wind size={13} />}
              name="WIND MODEL"
              status="SYNC"
            />

            <DataStream
              icon={<Waves size={13} />}
              name="OCEAN CURRENT"
              status="SYNC"
            />
          </div>
        </aside>

        {/* MAP */}
        <section className="map-area">
          <MapContainer
            center={[18, 65]}
            zoom={5}
            minZoom={4}
            maxZoom={10}
            maxBounds={[
              [-55, -180],
              [75, 180],
            ]}
            maxBoundsViscosity={1}
            worldCopyJump={false}
            zoomControl={false}
          >
            <MapController incident={selectedIncident} />

            {mapMode === "chart" ? (
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            ) : (
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            )}

            {/* SELECTED SPILL */}
            <Circle
              center={[selectedIncident.lat, selectedIncident.lng]}
              radius={28000}
              pathOptions={{
                color: "#f59e0b",
                weight: 1,
                opacity: 0.7,
                fillColor: "#f59e0b",
                fillOpacity: 0.08,
              }}
            />

            <CircleMarker
              center={[selectedIncident.lat, selectedIncident.lng]}
              radius={9}
              pathOptions={{
                color: "#f59e0b",
                weight: 2,
                fillColor: "#ff8a00",
                fillOpacity: 1,
              }}
            />

            {/* OTHER INCIDENTS */}
            {incidents
              .filter((i) => i.id !== selectedIncident.id)
              .map((incident) => (
                <CircleMarker
                  key={incident.id}
                  center={[incident.lat, incident.lng]}
                  radius={5}
                  eventHandlers={{
                    click: () => selectIncident(incident),
                  }}
                  pathOptions={{
                    color:
                      incident.severity === "HIGH"
                        ? "#f59e0b"
                        : incident.severity === "MED"
                        ? "#d6aa45"
                        : "#58d6b0",
                    weight: 1,
                    fillOpacity: 0.9,
                  }}
                />
              ))}

            {/* AIS TRACK */}
            <Polyline
              positions={vesselTrack}
              pathOptions={{
                color: "#e6e9eb",
                weight: 2,
                opacity: 0.7,
              }}
            />

            {/* PREDICTED DRIFT */}
            <Polyline
              positions={predictedTrack}
              pathOptions={{
                color: "#f59e0b",
                weight: 2,
                opacity: 0.8,
                dashArray: "7 8",
              }}
            />

            {/* VESSEL */}
            <CircleMarker
              center={vesselTrack[vesselTrack.length - 1]}
              radius={6}
              pathOptions={{
                color: "#63e6c2",
                weight: 2,
                fillColor: "#63e6c2",
                fillOpacity: 1,
              }}
            />
          </MapContainer>

          {/* SELECTED INCIDENT MAP LABEL */}
          <div className="map-incident-label">
            <div className="label-kicker">SELECTED INCIDENT</div>
            <div className="label-id">{selectedIncident.id}</div>
            <div className="label-coords">
              {selectedIncident.lat.toFixed(3)}° N&nbsp;&nbsp;
              {selectedIncident.lng.toFixed(3)}° E
            </div>
          </div>

          {/* MAP CONTROLS */}
          <div className="map-controls">
            <div className="map-switch">
              <button
                className={mapMode === "chart" ? "active" : ""}
                onClick={() => setMapMode("chart")}
              >
                <Navigation size={13} />
                CHART
              </button>

              <button
                className={mapMode === "satellite" ? "active" : ""}
                onClick={() => setMapMode("satellite")}
              >
                <Satellite size={13} />
                SATELLITE
              </button>
            </div>

            <button
              className="map-tool"
              onClick={() =>
                document.querySelector(".leaflet-container") &&
                window.dispatchEvent(new Event("resize"))
              }
            >
              <Crosshair size={15} />
            </button>

            <button
              className={`map-tool ${showLayers ? "active" : ""}`}
              onClick={() => setShowLayers(!showLayers)}
            >
              <Layers size={15} />
            </button>
          </div>

          {/* WIND INDICATOR */}
          <div className="wind-indicator">
            <Wind size={14} />
            <span>SW</span>
            <strong>→</strong>
            <span>5.8 m/s</span>
          </div>

          {/* LAYER PANEL */}
          {showLayers && (
            <div className="layer-panel">
              <div className="layer-title">MAP LAYERS</div>

              <LayerRow
                label="OIL DETECTION"
                type="oil"
                enabled
              />

              <LayerRow
                label="AIS TRACK"
                type="ais"
                enabled
              />

              <LayerRow
                label="PREDICTED DRIFT"
                type="drift"
                enabled
              />

              <LayerRow
                label="WIND FIELD"
                type="wind"
                enabled
              />

              <LayerRow
                label="VESSELS"
                type="vessel"
                enabled
              />
            </div>
          )}

          {/* MAP LEGEND */}
          <div className="map-legend">
            <LegendLine type="oil" label="OIL DETECTION" />
            <LegendLine type="ais" label="AIS TRACK" />
            <LegendLine type="drift" label="PREDICTED DRIFT" />
            <LegendLine type="vessel" label="VESSEL" />
          </div>
        </section>
      </main>

      {/* INCIDENT INTELLIGENCE PANEL */}
      <section className="intel-panel">
        <div className="intel-header">
          <div className="active-incident">
            <div className="alert-icon">
              <AlertTriangle size={17} />
            </div>

            <div>
              <div className="intel-kicker">ACTIVE INCIDENT</div>
              <div className="intel-title-row">
                <strong>{selectedIncident.id}</strong>
                <span>{selectedIncident.location}</span>
                <i />
                <span>{selectedIncident.time}</span>
              </div>
            </div>
          </div>

          <div className="confidence">
            <span>DETECTION CONFIDENCE</span>
            <strong>{selectedIncident.confidence}%</strong>
          </div>

          <button className="close-panel">
            <X size={15} />
          </button>
        </div>

        {/* RELATIONSHIP CHAIN */}
        <div className="relationship">
          <RelationshipNode active icon="◉" label="SPILL" />
          <ChevronRight />
          <RelationshipNode icon="◎" label="SOURCE" />
          <ChevronRight />
          <RelationshipNode icon="♧" label="VESSEL" />
          <ChevronRight />
          <RelationshipNode icon="↗" label="TRAJECTORY" />
          <ChevronRight />
          <RelationshipNode icon="≋" label="IMPACT" />
        </div>

        {/* TABS */}
        <div className="intel-tabs">
          {["detection", "vessels", "forecast", "impact"].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="intel-content">
          {activeTab === "detection" && (
            <DetectionPanel incident={selectedIncident} />
          )}

          {activeTab === "vessels" && (
            <VesselPanel incident={selectedIncident} />
          )}

          {activeTab === "forecast" && (
            <ForecastPanel incident={selectedIncident} />
          )}

          {activeTab === "impact" && (
            <ImpactPanel incident={selectedIncident} />
          )}
        </div>

        <div className="event-timeline">
          <div className="timeline-label">
            <Activity size={12} />
            EVENT TIMELINE
          </div>

          <div className="timeline">
            <div className="timeline-line" />

            {["NOW", "+6H", "+12H", "+24H", "+48H"].map(
              (time, index) => (
                <div className="timeline-point" key={time}>
                  <span className={index === 0 ? "active" : ""} />
                  <label>{time}</label>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function DataStream({ icon, name, status }) {
  return (
    <div className="data-stream">
      <span className="stream-icon">{icon}</span>
      <span>{name}</span>
      <strong>{status}</strong>
    </div>
  );
}

function RelationshipNode({ icon, label, active }) {
  return (
    <div className={`relationship-node ${active ? "active" : ""}`}>
      <span>{icon}</span>
      <label>{label}</label>
    </div>
  );
}

function LegendLine({ type, label }) {
  return (
    <div className="legend-line">
      <span className={`legend-symbol ${type}`} />
      <label>{label}</label>
    </div>
  );
}

function LayerRow({ label, type, enabled }) {
  return (
    <div className="layer-row">
      <span className={`legend-symbol ${type}`} />
      <span>{label}</span>
      <div className={`toggle ${enabled ? "on" : ""}`}>
        <span />
      </div>
    </div>
  );
}

function DetectionPanel({ incident }) {
  return (
    <div className="detection-grid">
      <Metric label="DETECTED" value={incident.time} />
      <Metric label="SPILL AREA" value={incident.area} />
      <Metric label="EST. AGE" value={incident.age} />

      <div className="suspected-source">
        <span className="metric-label">SUSPECTED SOURCE</span>

        <div className="vessel-info">
          <div className="vessel-icon">
            <Ship size={17} />
          </div>

          <div>
            <strong>{incident.vessel}</strong>
            <small>MMSI {incident.mmsi} · TANKER</small>
          </div>
        </div>
      </div>

      <Attribution incident={incident} />

      <button className="evidence-button">
        VIEW EVIDENCE
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function VesselPanel({ incident }) {
  return (
    <div className="vessel-panel">
      <div className="vessel-summary">
        <div className="large-vessel-icon">
          <Ship size={22} />
        </div>

        <div>
          <span className="metric-label">SUSPECTED VESSEL</span>
          <h2>{incident.vessel}</h2>
          <small>MMSI {incident.mmsi} · TANKER</small>
        </div>

        <div className="attribution-large">
          <span>ATTRIBUTION</span>
          <strong>{incident.attribution}%</strong>
          <small>HIGH</small>
        </div>
      </div>

      <div className="evidence-grid">
        <Evidence label="SPATIAL" value={incident.spatial} />
        <Evidence label="TEMPORAL" value={incident.temporal} />
        <Evidence label="TRAJECTORY" value={incident.trajectory} />
        <Evidence label="HEADING" value={incident.heading} />
      </div>

      <button className="evidence-button">
        VIEW FULL EVIDENCE
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function ForecastPanel() {
  return (
    <div className="forecast-panel">
      <div className="forecast-heading">
        <div>
          <span className="metric-label">SPILL FORECAST</span>
          <h2>Predicted Drift</h2>
        </div>

        <div className="forecast-time">NOW + 48H</div>
      </div>

      <div className="forecast-strip">
        <span className="selected">NOW</span>
        <span>+6H</span>
        <span>+12H</span>
        <span>+24H</span>
        <span>+48H</span>
      </div>

      <div className="impact-row">
        <ImpactTime label="MANGROVE" time="11h" />
        <ImpactTime label="FISHING ZONE" time="17h" />
        <ImpactTime label="COASTLINE" time="24h" />
        <div className="priority">
          <span>RESPONSE PRIORITY</span>
          <strong>HIGH</strong>
        </div>
      </div>
    </div>
  );
}

function ImpactPanel() {
  return (
    <div className="impact-panel">
      <div className="impact-title">
        <div>
          <span className="metric-label">PROJECTED IMPACT</span>
          <h2>Environmental Exposure</h2>
        </div>

        <span className="risk-badge">HIGH RISK</span>
      </div>

      <div className="impact-grid">
        <ImpactCard name="MANGROVE" distance="18.4 km" status="CRITICAL" />
        <ImpactCard name="FISHING ZONE" distance="31.7 km" status="HIGH" />
        <ImpactCard name="COASTLINE" distance="48.2 km" status="MED" />
        <ImpactCard name="PROTECTED AREA" distance="64.1 km" status="LOW" />
      </div>
    </div>
  );
}

function Attribution({ incident }) {
  return (
    <div className="attribution-block">
      <span className="metric-label">ATTRIBUTION</span>
      <strong>{incident.attribution}%</strong>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Evidence({ label, value }) {
  return (
    <div className="evidence">
      <div className="evidence-head">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>

      <div className="evidence-bar">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ImpactTime({ label, time }) {
  return (
    <div className="impact-time">
      <span>{label}</span>
      <strong>{time}</strong>
    </div>
  );
}

function ImpactCard({ name, distance, status }) {
  return (
    <div className="impact-card">
      <span className={`impact-dot ${status}`} />
      <div>
        <strong>{name}</strong>
        <small>{distance} from projected boundary</small>
      </div>
      <span className={`impact-status ${status}`}>{status}</span>
    </div>
  );
}

export default App;

