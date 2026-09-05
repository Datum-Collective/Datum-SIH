import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";

const SHIPPING_LANES_URL =
  "/data/Shipping_Lanes_v1.geojson";

export default function ShippingLanes({
  visible = true,
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;

    fetch(SHIPPING_LANES_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        return response.json();
      })
      .then((geojson) => {
        if (cancelled) {
          return;
        }

        console.log(
          "[OSIRIS] Shipping lanes loaded:",
          geojson.features?.length ?? 0
        );

        setData(geojson);
      })
      .catch((error) => {
        console.error(
          "[OSIRIS] Failed to load shipping lanes:",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible || !data) {
    return null;
  }

  return (
    <GeoJSON
      data={data}
      style={(feature) => {
        const type =
          feature?.properties?.Type;

        if (type === "Major") {
          return {
            color: "#35c7d8",
            weight: 1.6,
            opacity: 0.7,
            dashArray: "2 7",
          };
        }

        if (type === "Middle") {
          return {
            color: "#35c7d8",
            weight: 1.1,
            opacity: 0.4,
            dashArray: "2 8",
          };
        }

        return {
          color: "#35c7d8",
          weight: 0.8,
          opacity: 0.22,
          dashArray: "1 9",
        };
      }}
    />
  );
}
