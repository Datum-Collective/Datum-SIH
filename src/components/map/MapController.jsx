import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function MapController({ incident }) {
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
