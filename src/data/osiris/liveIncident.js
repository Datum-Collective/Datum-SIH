import liveDetections from "./live-detections.json";

function geometryToLeafletPolygon(geometry) {
  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return geometry.coordinates[0].map(
      ([lng, lat]) => [lat, lng]
    );
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates[0][0].map(
      ([lng, lat]) => [lat, lng]
    );
  }

  return [];
}

function formatUtc(iso) {
  if (!iso) {
    return "UNKNOWN";
  }

  return new Date(iso)
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}

function confidencePercent(value) {
  return Math.round((value ?? 0) * 100);
}

const feature = liveDetections.features[0];

const properties = feature.properties;

const spillPolygon = geometryToLeafletPolygon(
  feature.geometry
);

export const liveOsirisIncident = {
  id: "OSIRIS-LIVE-001",

  location: "Arabian Sea",

  lat: properties.centroid_lat,
  lng: properties.centroid_lon,

  confidence: confidencePercent(
    properties.mean_confidence
  ),

  peakConfidence: confidencePercent(
    properties.max_confidence
  ),

  severity:
    properties.mean_confidence >= 0.75
      ? "HIGH"
      : properties.mean_confidence >= 0.60
      ? "MED"
      : "LOW",

  time: formatUtc(properties.acquisition),

  area: `${properties.area_km2.toFixed(3)} km²`,

  areaKm2: properties.area_km2,

  age: "LIVE",

  vessel: "PENDING AIS CORRELATION",

  mmsi: "PENDING",

  vesselType: "UNKNOWN",

  attribution: 0,

  spatial: 0,

  temporal: 0,

  trajectory: 0,

  heading: 0,

  behavioral: 0,

  wind: "PENDING",

  current: "PENDING",

  vesselPosition: [
    properties.centroid_lat,
    properties.centroid_lon,
  ],

  aisTrack: [],

  forecast: [],

  spillPolygon,

  osiris: {
    rank: properties.rank,
    pixels: properties.pixels,

    meanConfidence:
      properties.mean_confidence,

    maxConfidence:
      properties.max_confidence,

    threshold: properties.threshold,

    acquisition:
      properties.acquisition,

    source: properties.source,

    model: properties.model,

    status: properties.status,
  },

  source: "OSIRIS",

  isLive: true,
};
