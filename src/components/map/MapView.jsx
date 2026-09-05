import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polyline,
  Polygon,
  Marker,
} from "react-leaflet";

import {
  Navigation,
  Satellite,
  Wind,
  ChevronUp,
  Ship,
} from "lucide-react";

import AISVessels from "./AISVessels";
import ShippingLanes from "./ShippingLanes";
import MapController from "./MapController";
import {
  createSpillIcon,
  createSourceIcon,
} from "./mapIcons";


function LegendLine({ type, label }) {
  return (
    <div className="legend-line">
      <span className={`legend-symbol ${type}`} />
      <span>{label}</span>
    </div>
  );
}


/* ============================================================
   SATELLITE DETECTIONS

   Temporary visual layer. These are independent of the AIS
   vessel system.
   ============================================================ */

const satelliteDetections = [
  [16.35, 63.85],
  [14.55, 66.95],
  [18.15, 67.45],
  [12.85, 64.55],
  [17.45, 70.15],
];


/* ============================================================
   SIMPLIFIED REGIONAL EEZ BOUNDARIES
   ============================================================ */

const eezBoundaries = [
  [
    [11.0, 57.0],
    [11.8, 60.0],
    [12.8, 63.0],
    [14.0, 66.0],
    [15.0, 69.0],
    [17.0, 72.0],
  ],

  [
    [8.5, 68.0],
    [11.0, 67.8],
    [14.0, 67.4],
    [17.0, 67.0],
    [20.0, 66.5],
    [23.0, 66.0],
  ],
];


export default function MapView({
  incident,
  incidents,
  mapMode,
  setMapMode,
  selectIncident,
  mapCenter,
}) {
  const [layers, setLayers] = useState({
    vesselTracks: true,
    satelliteDetections: true,
    oilSpill: true,
    shippingLanes: false,
    eezBoundaries: false,
  });

  const [layersOpen, setLayersOpen] = useState(true);


  const toggleLayer = (layer) => {
    setLayers((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  };


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


        {/* =====================================================
            BASE MAP
            ===================================================== */}

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
            REAL LIVE AIS VESSELS
            ===================================================== */}

        <AISVessels
          visible={layers.vesselTracks}
        />


        {/* =====================================================
            REAL GLOBAL SHIPPING LANES
            ===================================================== */}

        <ShippingLanes
          visible={layers.shippingLanes}
        />


        {/* =====================================================
            EEZ BOUNDARIES
            ===================================================== */}

        {layers.eezBoundaries &&
          eezBoundaries.map((line, index) => (
            <Polyline
              key={`eez-${index}`}
              positions={line}
              pathOptions={{
                color: "#718089",
                weight: 1,
                opacity: 0.5,
                dashArray: "2 6",
              }}
            />
          ))}


        {/* =====================================================
            SATELLITE DETECTIONS
            ===================================================== */}

        {layers.satelliteDetections &&
          satelliteDetections.map((position, index) => (
            <CircleMarker
              key={`sat-${index}`}
              center={position}
              radius={4}
              pathOptions={{
                color: "#51dce8",
                weight: 1,
                fillColor: "#51dce8",
                fillOpacity: 0.35,
                opacity: 0.8,
              }}
            />
          ))}


        {/* =====================================================
            SELECTED OIL SPILL
            ===================================================== */}

        {layers.oilSpill && (
          <>
            <Polygon
              positions={incident.spillPolygon}
              pathOptions={{
                color: "#ff6657",
                weight: 1.5,
                opacity: 0.85,
                fillColor: "#071116",
                fillOpacity:
                  mapMode === "satellite" ? 0.34 : 0.22,
                dashArray: "3 4",
                lineCap: "round",
                lineJoin: "round",
              }}
            />

            <Circle
              center={[incident.lat, incident.lng]}
              radius={24000}
              pathOptions={{
                color: "#8a3f3b",
                weight: 1,
                opacity: 0.35,
                fillColor: "#03080b",
                fillOpacity:
                  mapMode === "satellite" ? 0.16 : 0.09,
              }}
            />

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

            <Marker
              position={[incident.lat, incident.lng]}
              icon={createSpillIcon(incident)}
              interactive={false}
            />
          </>
        )}


        {/* =====================================================
            PROBABLE SOURCE
            ===================================================== */}

        {layers.vesselTracks && (
          <>
            <Marker
              position={incident.vesselPosition}
              icon={createSourceIcon(incident)}
              interactive={false}
            />

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
          </>
        )}


        {/* =====================================================
            SELECTED INCIDENT AIS TRACK
            =====================================================

            This is the existing incident-specific track from
            the incident data model. It is separate from the
            global live AISVessels layer above.
            ===================================================== */}

        {layers.vesselTracks && incident.aisTrack && (
          <Polyline
            positions={incident.aisTrack}
            pathOptions={{
              color: "#51dce8",
              weight: 1.8,
              opacity: 0.72,
              dashArray: "3 7",
            }}
          />
        )}


        {/* =====================================================
            PREDICTED DRIFT
            ===================================================== */}

        {layers.oilSpill && (
          <>
            <Polyline
              positions={incident.forecast}
              pathOptions={{
                color: "#ffad19",
                weight: 1.5,
                opacity: 0.78,
                dashArray: "7 8",
              }}
            />

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
          </>
        )}


        {/* =====================================================
            OTHER INCIDENTS
            ===================================================== */}

        {layers.oilSpill &&
          incidents
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
          SELECTED INCIDENT
          ======================================================= */}

      <div className="map-incident-label">

        <div className="label-kicker">
          SELECTED INCIDENT
        </div>

        <div className="label-id">
          {incident.id}
        </div>

        <div className="label-location">
          {incident.name ||
            incident.region ||
            "Arabian Sea"}
        </div>

        <div className="label-coords">
          {incident.lat.toFixed(3)}° N&nbsp;&nbsp;
          {incident.lng.toFixed(3)}° E
        </div>

      </div>


      {/* =======================================================
          CHART / SATELLITE
          ======================================================= */}

      <div className="map-controls">

        <div className="map-switch">

          <button
            className={
              mapMode === "chart"
                ? "active"
                : ""
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
            onClick={() =>
              setMapMode("satellite")
            }
          >
            <Satellite size={13} />
            SATELLITE
          </button>

        </div>

      </div>


      {/* =======================================================
          WIND
          ======================================================= */}

      <div className="wind-indicator">

        <Wind size={14} />

        <span>SW</span>

        <strong>→</strong>

        <span>
          {incident.wind.replace(" SW", "")}
        </span>

      </div>


      {/* =======================================================
          MAP LAYERS
          ======================================================= */}

      <div
        className={`map-layer-panel ${
          layersOpen ? "open" : "closed"
        }`}
      >

        <button
          className="map-layer-header"
          onClick={() =>
            setLayersOpen((value) => !value)
          }
        >

          <span>MAP LAYERS</span>

          <ChevronUp
            size={12}
            className={
              layersOpen
                ? ""
                : "collapsed"
            }
          />

        </button>


        {layersOpen && (
          <div className="map-layer-options">


            {/* =================================================
                LIVE AIS
                ================================================= */}

            <label className="layer-option">

              <input
                type="checkbox"
                checked={layers.vesselTracks}
                onChange={() =>
                  toggleLayer("vesselTracks")
                }
              />

              <span className="layer-checkbox" />

              <Ship size={11} />

              <span>
                Vessel Tracks (AIS)
              </span>

            </label>


            {/* =================================================
                SATELLITE
                ================================================= */}

            <label className="layer-option">

              <input
                type="checkbox"
                checked={
                  layers.satelliteDetections
                }
                onChange={() =>
                  toggleLayer(
                    "satelliteDetections"
                  )
                }
              />

              <span className="layer-checkbox" />

              <span className="layer-detection" />

              <span>
                Satellite Detections
              </span>

            </label>


            {/* =================================================
                OIL SPILL
                ================================================= */}

            <label className="layer-option">

              <input
                type="checkbox"
                checked={layers.oilSpill}
                onChange={() =>
                  toggleLayer("oilSpill")
                }
              />

              <span className="layer-checkbox" />

              <span className="layer-oil" />

              <span>
                Oil Spill (AI)
              </span>

            </label>


            {/* =================================================
                REAL SHIPPING LANES
                ================================================= */}

            <label className="layer-option">

              <input
                type="checkbox"
                checked={layers.shippingLanes}
                onChange={() =>
                  toggleLayer("shippingLanes")
                }
              />

              <span className="layer-checkbox" />

              <span className="layer-lane" />

              <span>
                Shipping Lanes
              </span>

            </label>


            {/* =================================================
                EEZ
                ================================================= */}

            <label className="layer-option">

              <input
                type="checkbox"
                checked={layers.eezBoundaries}
                onChange={() =>
                  toggleLayer("eezBoundaries")
                }
              />

              <span className="layer-checkbox" />

              <span className="layer-eez" />

              <span>
                EEZ Boundaries
              </span>

            </label>

          </div>
        )}

      </div>


      {/* =======================================================
          LEGEND
          ======================================================= */}

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
