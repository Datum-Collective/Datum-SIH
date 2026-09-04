import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, Polygon, Marker } from "react-leaflet";
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

export default function MapView({ incident, incidents, mapMode, setMapMode, selectIncident, mapCenter }) {
  return (
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
  );
}
