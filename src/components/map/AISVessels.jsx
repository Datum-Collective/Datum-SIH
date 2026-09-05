import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const AIS_WS_URL = "ws://localhost:8787";

const RENDER_INTERVAL_MS = 100;
const MAX_DPR = 1.5;

const VESSEL_RADIUS = 2.8;
const VESSEL_HIT_RADIUS = 10;

const GRID_SIZE = 60;

function normalizeVessel(vessel) {
  return {
    ...vessel,

    mmsi: String(vessel.mmsi),

    name:
      vessel.name ||
      vessel.shipName ||
      vessel.ShipName ||
      "UNKNOWN VESSEL",

    lat: Number(vessel.lat),
    lng: Number(vessel.lng),

    speed: Number.isFinite(Number(vessel.speed))
      ? Number(vessel.speed)
      : null,

    course: Number.isFinite(Number(vessel.course))
      ? Number(vessel.course)
      : null,

    heading: Number.isFinite(Number(vessel.heading))
      ? Number(vessel.heading)
      : null,
  };
}

function formatNumber(value, decimals = 1) {
  return Number.isFinite(value)
    ? value.toFixed(decimals)
    : "—";
}

function formatAngle(value) {
  return Number.isFinite(value)
    ? `${Math.round(value)}°`
    : "—";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPopupHtml(vessel) {
  return `
    <div class="osiris-vessel-popup">
      <div class="vessel-popup-kicker">
        AIS VESSEL
      </div>

      <div class="vessel-popup-name">
        ${escapeHtml(vessel.name)}
      </div>

      <div class="vessel-popup-mmsi">
        MMSI ${escapeHtml(vessel.mmsi)}
      </div>

      <div class="vessel-popup-divider"></div>

      <div class="vessel-popup-row">
        <span>POSITION</span>
        <strong>
          ${formatNumber(vessel.lat, 4)}°
          ${formatNumber(vessel.lng, 4)}°
        </strong>
      </div>

      <div class="vessel-popup-row">
        <span>SPEED</span>
        <strong>
          ${
            Number.isFinite(vessel.speed)
              ? `${formatNumber(vessel.speed, 1)} kn`
              : "—"
          }
        </strong>
      </div>

      <div class="vessel-popup-row">
        <span>COURSE</span>
        <strong>
          ${formatAngle(vessel.course)}
        </strong>
      </div>

      <div class="vessel-popup-row">
        <span>HEADING</span>
        <strong>
          ${formatAngle(vessel.heading)}
        </strong>
      </div>
    </div>
  `;
}

export default function AISVessels({ visible = true }) {
  const map = useMap();

  /*
   * All AIS state lives outside React.
   *
   * React never receives thousands of vessel updates.
   */
  const vesselsRef = useRef(new Map());

  /*
   * Incoming WebSocket updates are buffered here.
   */
  const pendingUpdatesRef = useRef(new Map());

  /*
   * One canvas renders every visible vessel.
   */
  const canvasRef = useRef(null);

  /*
   * Canvas drawing context.
   */
  const contextRef = useRef(null);

  /*
   * Animation / redraw state.
   */
  const animationFrameRef = useRef(null);
  const lastRenderRef = useRef(0);
  const redrawRequestedRef = useRef(false);
  const mapMovingRef = useRef(false);
  /*
   * Spatial grid used for fast vessel click detection.
   */
  const hitGridRef = useRef(new Map());

  /*
   * Currently selected vessel.
   */
  const selectedMmsiRef = useRef(null);

  /*
   * Fallback trail for the selected vessel.
   */
  const selectedTrailRef = useRef(null);

  /*
   * AIS backend WebSocket.
   */
  const wsRef = useRef(null);

  /*
   * Create the canvas once.
   */
  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const canvas = document.createElement("canvas");

    canvas.className = "osiris-ais-canvas";

    /*
     * IMPORTANT:
     *
     * The canvas is attached directly to the map container,
     * NOT Leaflet's overlayPane.
     *
     * latLngToContainerPoint() returns coordinates relative
     * to the map container. Keeping the canvas in the same
     * coordinate system prevents the vessel positions from
     * drifting when the map is panned.
     */
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";

    /*
     * Let Leaflet receive mouse/touch events normally.
     * Vessel selection is handled through the map click event.
     */
    canvas.style.pointerEvents = "none";

    /*
     * Above map overlays but below Leaflet popups.
     */
    canvas.style.zIndex = "450";

    canvasRef.current = canvas;

    const mapContainer = map.getContainer();

    mapContainer.appendChild(canvas);

    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!context) {
      console.error(
        "[OSIRIS AIS] Failed to create Canvas 2D context"
      );

      return () => {
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        canvasRef.current = null;
      };
    }

    contextRef.current = context;

    /*
     * Size the canvas to the map viewport.
     */
    const resizeCanvas = () => {
      const size = map.getSize();

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        MAX_DPR
      );

      canvas.width =
        Math.max(1, Math.round(size.x * dpr));

      canvas.height =
        Math.max(1, Math.round(size.y * dpr));

      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;

      context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      redrawRequestedRef.current = true;
    };

    resizeCanvas();

    map.on("resize", resizeCanvas);

    return () => {
      map.off("resize", resizeCanvas);

      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }

      canvasRef.current = null;
      contextRef.current = null;
      hitGridRef.current.clear();
    };
  }, [map]);

  /*
   * Handle vessel selection.
   *
   * The canvas itself does NOT receive pointer events.
   * Instead, Leaflet's map click event gives us the exact
   * container coordinates of the click.
   */
  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const handleClick = (event) => {
      if (!visible) {
        return;
      }

      const point = event.containerPoint;

      const x = point.x;
      const y = point.y;

      const gridX =
        Math.floor(x / GRID_SIZE);

      const gridY =
        Math.floor(y / GRID_SIZE);

      let nearest = null;

      let nearestDistanceSq =
        VESSEL_HIT_RADIUS *
        VESSEL_HIT_RADIUS;

      /*
       * Search the clicked cell and neighbouring cells.
       */
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const key =
            `${gridX + dx}:${gridY + dy}`;

          const candidates =
            hitGridRef.current.get(key);

          if (!candidates) {
            continue;
          }

          for (const candidate of candidates) {
            const px = candidate.x - x;
            const py = candidate.y - y;

            const distanceSq =
              px * px + py * py;

            if (
              distanceSq <
              nearestDistanceSq
            ) {
              nearestDistanceSq =
                distanceSq;

              nearest =
                vesselsRef.current.get(
                  candidate.mmsi
                );
            }
          }
        }
      }

      if (!nearest) {
        return;
      }

      selectedMmsiRef.current =
        nearest.mmsi;

      selectedTrailRef.current =
        nearest.trail || [];

      redrawRequestedRef.current = true;

      L.popup({
        closeButton: true,
        autoPan: true,
        className:
          "osiris-vessel-popup-container",
        maxWidth: 280,
      })
        .setLatLng([
          nearest.lat,
          nearest.lng,
        ])
        .setContent(
          buildPopupHtml(nearest)
        )
        .openOn(map);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, visible]);

  /*
   * WebSocket connection.
   *
   * Incoming AIS messages never trigger React renders.
   */
  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const socket =
      new WebSocket(AIS_WS_URL);

    wsRef.current = socket;

    socket.onopen = () => {
      console.log(
        "[OSIRIS AIS] Connected to backend"
      );
    };

    socket.onmessage = (event) => {
      try {
        const message =
          JSON.parse(event.data);

        /*
         * Initial snapshot.
         */
        if (
          message.type ===
          "vessel:snapshot"
        ) {
          const snapshot =
            message.vessels || {};

          const vessels =
            Array.isArray(snapshot)
              ? snapshot
              : Object.values(snapshot);

          for (const rawVessel of vessels) {
            const vessel =
              normalizeVessel(rawVessel);

            if (
              !Number.isFinite(vessel.lat) ||
              !Number.isFinite(vessel.lng)
            ) {
              continue;
            }

            vesselsRef.current.set(
              vessel.mmsi,
              vessel
            );
          }

          console.log(
            `[OSIRIS AIS] ${vessels.length} live vessels`
          );

          redrawRequestedRef.current =
            true;

          return;
        }

        /*
         * Live position update.
         */
        if (
          message.type ===
            "vessel:update" &&
          message.vessel
        ) {
          const vessel =
            normalizeVessel(
              message.vessel
            );

          if (
            !Number.isFinite(vessel.lat) ||
            !Number.isFinite(vessel.lng)
          ) {
            return;
          }

          /*
           * Keep only the newest update
           * for each vessel until the next
           * render batch.
           */
          pendingUpdatesRef.current.set(
            vessel.mmsi,
            vessel
          );

          return;
        }

        /*
         * Vessel became stale / disappeared.
         */
        if (
          message.type ===
          "vessel:remove"
        ) {
          const mmsi =
            String(message.mmsi);

          vesselsRef.current.delete(
            mmsi
          );

          pendingUpdatesRef.current.delete(
            mmsi
          );

          if (
            selectedMmsiRef.current ===
            mmsi
          ) {
            selectedMmsiRef.current =
              null;

            selectedTrailRef.current =
              null;

            map.closePopup();
          }

          redrawRequestedRef.current =
            true;
        }
      } catch (error) {
        console.error(
          "[OSIRIS AIS] Failed to process message:",
          error
        );
      }
    };

    socket.onerror = (error) => {
      console.error(
        "[OSIRIS AIS] WebSocket error:",
        error
      );
    };

    socket.onclose = () => {
      console.log(
        "[OSIRIS AIS] Disconnected from backend"
      );
    };

    return () => {
      if (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      ) {
        socket.close();
      }

      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };
  }, [map]);

  /*
   * Flush buffered AIS updates into the main
   * vessel store every 100 ms.
   *
   * If 20 updates for one vessel arrive during
   * that period, only the newest one is retained.
   */
  useEffect(() => {
    const interval =
      window.setInterval(() => {
        const pending =
          pendingUpdatesRef.current;

        if (!pending.size) {
          return;
        }

        for (
          const [
            mmsi,
            vessel,
          ] of pending
        ) {
          vesselsRef.current.set(
            mmsi,
            vessel
          );

          if (
            selectedMmsiRef.current ===
            mmsi
          ) {
            selectedTrailRef.current =
              vessel.trail || [];
          }
        }

        pending.clear();

        redrawRequestedRef.current =
          true;
      }, RENDER_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

/*
 * Keep the AIS canvas synchronized with Leaflet
 * while the map is moving.
 *
 * During movement we render every animation frame.
 * Once movement stops we return to the normal
 * low-frequency renderer.
 */
useEffect(() => {
  if (!map) {
    return undefined;
  }

  const handleMoveStart = () => {
    mapMovingRef.current = true;
    redrawRequestedRef.current = true;
  };

  const handleMove = () => {
    redrawRequestedRef.current = true;
  };

  const handleMoveEnd = () => {
    mapMovingRef.current = false;
    redrawRequestedRef.current = true;
  };

  const handleZoomStart = () => {
    mapMovingRef.current = true;
    redrawRequestedRef.current = true;
  };

  const handleZoom = () => {
    redrawRequestedRef.current = true;
  };

  const handleZoomEnd = () => {
    mapMovingRef.current = false;
    redrawRequestedRef.current = true;
  };

  map.on(
    "movestart",
    handleMoveStart
  );

  map.on(
    "move",
    handleMove
  );

  map.on(
    "moveend",
    handleMoveEnd
  );

  map.on(
    "zoomstart",
    handleZoomStart
  );

  map.on(
    "zoom",
    handleZoom
  );

  map.on(
    "zoomend",
    handleZoomEnd
  );

  return () => {
    map.off(
      "movestart",
      handleMoveStart
    );

    map.off(
      "move",
      handleMove
    );

    map.off(
      "moveend",
      handleMoveEnd
    );

    map.off(
      "zoomstart",
      handleZoomStart
    );

    map.off(
      "zoom",
      handleZoom
    );

    map.off(
      "zoomend",
      handleZoomEnd
    );
  };
}, [map]);
  /*
   * Main Canvas rendering loop.
   */
  useEffect(() => {
    if (!map) {
      return undefined;
    }

    const render = (timestamp) => {
      animationFrameRef.current =
        requestAnimationFrame(render);

      if (!visible) {
        return;
      }

      /*
       * Limit rendering to roughly 10 FPS.
       */
const renderInterval =
  mapMovingRef.current
    ? 0
    : RENDER_INTERVAL_MS;

if (
  timestamp -
    lastRenderRef.current <
  renderInterval
) {
  return;
}
      /*
       * Don't redraw unless something changed.
       */
      if (
        !redrawRequestedRef.current
      ) {
        return;
      }

      lastRenderRef.current =
        timestamp;

      redrawRequestedRef.current =
        false;

      const canvas =
        canvasRef.current;

      const context =
        contextRef.current;

      if (!canvas || !context) {
        return;
      }

      const size = map.getSize();

      /*
       * Clear the viewport.
       */
      context.clearRect(
        0,
        0,
        size.x,
        size.y
      );

      /*
       * Rebuild the click-detection grid.
       */
      const hitGrid = new Map();

      hitGridRef.current =
        hitGrid;

      /*
       * Geographic viewport.
       *
       * Vessels outside this area are not projected
       * or drawn at all.
       */
      const bounds =
        map.getBounds();

      const vessels =
        vesselsRef.current;

      /*
       * Draw visible vessels.
       */
      for (
        const vessel of vessels.values()
      ) {
        if (
          !Number.isFinite(
            vessel.lat
          ) ||
          !Number.isFinite(
            vessel.lng
          )
        ) {
          continue;
        }

        /*
         * Viewport culling.
         */
        if (
          !bounds.contains([
            vessel.lat,
            vessel.lng,
          ])
        ) {
          continue;
        }

        /*
         * IMPORTANT:
         *
         * This coordinate is relative to the
         * map container, which is also where
         * our canvas lives.
         */
        const point =
          map.latLngToContainerPoint([
            vessel.lat,
            vessel.lng,
          ]);

        /*
         * Small pixel safety margin.
         */
        if (
          point.x < -20 ||
          point.y < -20 ||
          point.x > size.x + 20 ||
          point.y > size.y + 20
        ) {
          continue;
        }

        const selected =
          selectedMmsiRef.current ===
          vessel.mmsi;

        const radius = selected
          ? 4.5
          : VESSEL_RADIUS;

        /*
         * Outer dark ring.
         */
        context.beginPath();

        context.arc(
          point.x,
          point.y,
          radius + 1,
          0,
          Math.PI * 2
        );

        context.fillStyle =
          "#07181d";

        context.fill();

        /*
         * Cyan AIS position.
         */
        context.beginPath();

        context.arc(
          point.x,
          point.y,
          radius,
          0,
          Math.PI * 2
        );

        context.fillStyle =
          "#35c7d8";

        context.globalAlpha =
          selected ? 1 : 0.9;

        context.fill();

        context.globalAlpha = 1;

        /*
         * Selected vessel heading indicator.
         */
        if (
          selected &&
          Number.isFinite(
            vessel.heading
          )
        ) {
          const angle =
            (
              vessel.heading *
              Math.PI
            ) /
              180;

          const length = 14;

          context.beginPath();

          context.moveTo(
            point.x,
            point.y
          );

          context.lineTo(
            point.x +
              Math.sin(angle) *
                length,
            point.y -
              Math.cos(angle) *
                length
          );

          context.strokeStyle =
            "#35c7d8";

          context.lineWidth = 1.5;

          context.stroke();
        }

        /*
         * Add vessel to the spatial hit grid.
         */
        const gridX =
          Math.floor(
            point.x / GRID_SIZE
          );

        const gridY =
          Math.floor(
            point.y / GRID_SIZE
          );

        const key =
          `${gridX}:${gridY}`;

        let cell =
          hitGrid.get(key);

        if (!cell) {
          cell = [];
          hitGrid.set(key, cell);
        }

        cell.push({
          mmsi: vessel.mmsi,
          x: point.x,
          y: point.y,
        });
      }

      /*
       * Draw ONLY the selected vessel's trail.
       */
      const selectedMmsi =
        selectedMmsiRef.current;

      if (selectedMmsi) {
        const selected =
          vesselsRef.current.get(
            selectedMmsi
          );

        const trail =
          selected?.trail ||
          selectedTrailRef.current;

        if (
          trail &&
          trail.length >= 2
        ) {
          const trailPoints =
            trail
              .filter(
                (point) =>
                  Number.isFinite(
                    Number(point.lat)
                  ) &&
                  Number.isFinite(
                    Number(point.lng)
                  )
              )
              .map((point) =>
                map.latLngToContainerPoint(
                  [
                    Number(point.lat),
                    Number(point.lng),
                  ]
                )
              );

          if (
            trailPoints.length >= 2
          ) {
            context.beginPath();

            context.moveTo(
              trailPoints[0].x,
              trailPoints[0].y
            );

            for (
              let i = 1;
              i < trailPoints.length;
              i += 1
            ) {
              context.lineTo(
                trailPoints[i].x,
                trailPoints[i].y
              );
            }

            context.strokeStyle =
              "#35c7d8";

            context.lineWidth = 2;

            context.globalAlpha = 0.75;

            context.setLineDash([
              5,
              6,
            ]);

            context.stroke();

            context.setLineDash([]);

            context.globalAlpha = 1;
          }
        }
      }
    };

    animationFrameRef.current =
      requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(
          animationFrameRef.current
        );
      }
    };
  }, [map, visible]);

  /*
   * React renders zero vessel elements.
   * Everything is painted directly onto Canvas.
   */
  return null;
}
