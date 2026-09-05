import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polyline,
  Polygon,
  Marker,
} from "react-leaflet";
import { Navigation, Satellite, Wind } from "lucide-react";
import MapController from "./MapController";
import { createSpillIcon, createSourceIcon } from "./mapIcons";

function LegendLine({ type, label }) {
  return (
    <div className="legend-line">
      <span className={`legend-symbol ${type}`} />
      <span>{label}</span>
    </div>
  );
}

export default function MapView({
  incident,
  incidents,
  mapMode,
  setMapMode,
  selectIncident,
  mapCenter,
}) {
  return (
    <section className={`map-area ${mapMode}`}>
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

        {mapMode === "chart" ? (
          <TileLayer
            attribution="&copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution="&copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        )}

        {/* =====================================================
            OIL SPILL
            The reference uses a restrained SAR-style signature:
            dark, diffuse, low-opacity fill + thin boundary.
        ===================================================== */}

        <Polygon
          positions={incident.spillPolygon}
          pathOptions={{
            color: "#ff6657",
            weight: 1.5,
            opacity: 0.85,
            fillColor: "#071116",
            fillOpacity: mapMode === "satellite" ? 0.34 : 0.22,
            dashArray: "3 4",
            lineCap: "round",
            lineJoin: "round",
          }}
        />

        {/* Diffuse detection core */}

        <Circle
          center={[incident.lat, incident.lng]}
          radius={24000}
          pathOptions={{
            color: "#8a3f3b",
            weight: 1,
            opacity: 0.35,
            fillColor: "#03080b",
            fillOpacity: mapMode === "satellite" ? 0.16 : 0.09,
          }}
        />

        {/* Small detection point */}

        <CircleMarker
          center={[incident.lat, incident.lng]}
          radius={5}
          pathOptions={{
            color: "#ff6657",
            weight: 1.5,
            fillColor: "#ff6657",
            fillOpacity: 0.95,
          }}
        />

        {/* Spill annotation */}

        <Marker
          position={[incident.lat, incident.lng]}
          icon={createSpillIcon(incident)}
          interactive={false}
        />

        {/* =====================================================
            PROBABLE SOURCE
        ===================================================== */}

        <Marker
          position={incident.vesselPosition}
          icon={createSourceIcon(incident)}
          interactive={false}
        />

        {/* =====================================================
            AIS TRACK
        ===================================================== */}

        <Polyline
          positions={incident.aisTrack}
          pathOptions={{
            color: "#51dce8",
            weight: 1.5,
            opacity: 0.72,
            dashArray: "3 7",
          }}
        />

        {/* =====================================================
            PREDICTED DRIFT
        ===================================================== */}

        <Polyline
          positions={incident.forecast}
          pathOptions={{
            color: "#ffad19",
            weight: 1.5,
            opacity: 0.78,
            dashArray: "7 8",
          }}
        />

        {/* Forecast envelope */}

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
            opacity: 0.18,
            fillColor: "#ffad19",
            fillOpacity: 0.018,
            dashArray: "5 8",
          }}
        />

        {/* =====================================================
            SOURCE / VESSEL
        ===================================================== */}

        <CircleMarker
          center={incident.vesselPosition}
          radius={6}
          pathOptions={{
            color: "#51dce8",
            weight: 1.5,
            fillColor: "#071116",
            fillOpacity: 1,
          }}
        />

        {/* =====================================================
            OTHER INCIDENTS
        ===================================================== */}

        {incidents
          .filter((item) => item.id !== incident.id)
          .map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.lat, item.lng]}
              radius={4}
              eventHandlers={{
                click: () => selectIncident(item),
              }}
              pathOptions={{
                color:
                  item.severity === "HIGH"
                    ? "#ff6657"
                    : item.severity === "MED"
                    ? "#ffad19"
                    : "#51d7be",
                weight: 1.25,
                fillOpacity: 0.9,
              }}
            />
          ))}
      </MapContainer>

      {/* =======================================================
          SELECTED INCIDENT CARD
      ======================================================= */}

      <div className="map-incident-label">
        <div className="label-kicker">
          SELECTED INCIDENT
        </div>

        <div className="label-id">
          {incident.id}
        </div>

        <div className="label-location">
          {incident.name || incident.region || "Arabian Sea"}
        </div>

        <div className="label-coords">
          {incident.lat.toFixed(3)}° N&nbsp;&nbsp;
          {incident.lng.toFixed(3)}° E
        </div>
      </div>

      {/* =======================================================
          MAP MODE
      ======================================================= */}

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
  );
}
