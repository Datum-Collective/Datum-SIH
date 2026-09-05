import L from "leaflet";

export function createSpillIcon(incident) {
  return L.divIcon({
    className: "spill-label-icon",
    html: `
      <div class="spill-label">
        <div class="spill-label-kicker">
          <span class="spill-warning">△</span>
          OIL SLICK DETECTION
        </div>

        <div class="spill-label-area">
          ${incident.area}
        </div>

        <div class="spill-label-time">
          DETECTED ${incident.time}
        </div>
      </div>
    `,
    iconSize: [174, 82],
    iconAnchor: [87, 41],
  });
}

export function createSourceIcon(incident) {
  return L.divIcon({
    className: "source-label-icon",
    html: `
      <div class="source-label">
        <div class="source-kicker">
          PROBABLE SOURCE
        </div>

        <div class="source-row">
          <span class="source-dot"></span>

          <span class="source-vessel">
            ${incident.vessel}
          </span>

          <strong>
            ${incident.attribution}%
          </strong>
        </div>
      </div>
    `,
    iconSize: [178, 54],
    iconAnchor: [89, 27],
  });
}
