import http from "node:http";
import WebSocket, { WebSocketServer } from "ws";

const PORT = Number(process.env.AIS_PORT || 8787);

const AISSTREAM_URL =
  "wss://stream.aisstream.io/v0/stream";


/* ============================================================
   GLOBAL AIS COVERAGE

   AISStream requires geographic bounding boxes.

   This covers the full world so OSIRIS can receive vessels
   globally rather than only around the Arabian Sea.
   ============================================================ */

const BOUNDING_BOXES = [
  [
    [-90, -180],
    [90, 180],
  ],
];


/* ============================================================
   VESSEL STATE
   ============================================================ */

const vessels = new Map();

const clients = new Set();

let aisSocket = null;
let reconnectTimer = null;

const MAX_TRAIL_POINTS = 120;

const VESSEL_TIMEOUT_MS =
  10 * 60 * 1000;

const RECONNECT_DELAY_MS =
  5000;


/* ============================================================
   LOGGING
   ============================================================ */

function log(message) {
  console.log(
    `[AIS] ${new Date().toISOString()} ${message}`
  );
}


/* ============================================================
   SAFE VALUE HELPERS
   ============================================================ */

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function getString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const string = String(value).trim();

  return string.length > 0
    ? string
    : null;
}


/* ============================================================
   AIS MESSAGE EXTRACTION
   ============================================================ */

function extractAISMessage(payload) {
  if (!payload) {
    return null;
  }

  const messageType =
    payload.MessageType;

  if (
    messageType !== "PositionReport"
  ) {
    return null;
  }

  const positionReport =
    payload.Message?.PositionReport;

  if (!positionReport) {
    return null;
  }

  return positionReport;
}


/* ============================================================
   NORMALIZE REAL AIS DATA
   ============================================================ */

function normalizeVessel(payload) {
  const report =
    extractAISMessage(payload);

  if (!report) {
    return null;
  }


  /*
   * AISStream puts normalized vessel metadata
   * in payload.MetaData.
   */

  const metadata =
    payload.MetaData || {};


  const mmsi =
    getString(
      metadata.MMSI ??
      report.UserID
    );


  const lat =
    getNumber(
      metadata.Latitude ??
      report.Latitude
    );


  const lng =
    getNumber(
      metadata.Longitude ??
      report.Longitude
    );


  if (
    !mmsi ||
    lat === null ||
    lng === null
  ) {
    return null;
  }


  /*
   * AISStream provides ShipName through MetaData
   * on PositionReport messages.
   */

  const name =
    getString(
      metadata.ShipName
    ) ||
    `VESSEL ${mmsi}`;


  const speed =
    getNumber(report.Sog);


  const course =
    getNumber(report.Cog);


  const heading =
    getNumber(report.TrueHeading);


  const timestamp =
    getNumber(report.Timestamp);


  const now =
    Date.now();


  const existing =
    vessels.get(mmsi);


  const point = [
    lat,
    lng,
  ];


  let trail = [];


  if (existing?.trail?.length) {
    trail = [
      ...existing.trail,
    ];
  }


  /*
   * Only append the new position when it actually
   * differs from the previous one.
   */

  const previous =
    trail[trail.length - 1];


  if (
    !previous ||
    previous[0] !== lat ||
    previous[1] !== lng
  ) {
    trail.push(point);
  }


  /*
   * Keep the trail bounded so thousands of vessels
   * don't grow memory forever.
   */

  if (
    trail.length >
    MAX_TRAIL_POINTS
  ) {
    trail =
      trail.slice(
        trail.length -
          MAX_TRAIL_POINTS
      );
  }


  const vessel = {
    mmsi,

    name,

    lat,
    lng,

    speed,

    course,

    heading,

    timestamp,

    trail,

    lastSeen: now,
  };


  vessels.set(
    mmsi,
    vessel
  );


  return vessel;
}


/* ============================================================
   SERIALIZE VESSEL
   ============================================================ */

function serializeVessel(vessel) {
  return {
    mmsi: vessel.mmsi,

    name: vessel.name,

    lat: vessel.lat,

    lng: vessel.lng,

    speed: vessel.speed,

    course: vessel.course,

    heading: vessel.heading,

    timestamp:
      vessel.timestamp,

    trail:
      vessel.trail,

    lastSeen:
      vessel.lastSeen,
  };
}


/* ============================================================
   BROADCAST
   ============================================================ */

function broadcast(message) {
  const payload =
    JSON.stringify(message);


  for (const client of clients) {
    if (
      client.readyState ===
      WebSocket.OPEN
    ) {
      client.send(payload);
    }
  }
}


function broadcastVessel(vessel) {
  broadcast({
    type: "vessel:update",
    vessel:
      serializeVessel(vessel),
  });
}


/* ============================================================
   AISSTREAM CONNECTION
   ============================================================ */

function connectAIS() {
  if (
    aisSocket &&
    (
      aisSocket.readyState ===
        WebSocket.OPEN ||
      aisSocket.readyState ===
        WebSocket.CONNECTING
    )
  ) {
    return;
  }


  log("Connecting to AISStream...");


  aisSocket =
    new WebSocket(
      AISSTREAM_URL,
      {
        perMessageDeflate: true,
      }
    );


  aisSocket.on(
    "open",
    () => {
      log(
        "Connected to AISStream."
      );


      const subscription = {
        APIKey:
          process.env
            .AISSTREAM_API_KEY,

        BoundingBoxes:
          BOUNDING_BOXES,

        FilterMessageTypes: [
          "PositionReport",
        ],
      };


      aisSocket.send(
        JSON.stringify(
          subscription
        )
      );


      log(
        "Subscribed to global AIS coverage."
      );
    }
  );


  aisSocket.on(
    "message",
    (raw) => {
      try {
        const payload =
          JSON.parse(
            raw.toString()
          );


        /*
         * Subscription confirmation
         */

        if (
          payload?.MessageType ===
          "SubscriptionConfirmation"
        ) {
          log(
            "Subscription confirmed."
          );

          return;
        }


        /*
         * Provider-side error
         */

        if (payload?.error) {
          console.error(
            "[AIS] AISStream error:",
            payload.error
          );

          return;
        }


        /*
         * Ignore anything other than
         * PositionReport.
         */

        if (
          payload?.MessageType !==
          "PositionReport"
        ) {
          return;
        }


        const vessel =
          normalizeVessel(
            payload
          );


        if (!vessel) {
          return;
        }


        log(
          `${vessel.name} ` +
          `(${vessel.mmsi}) ` +
          `${vessel.lat.toFixed(4)}, ` +
          `${vessel.lng.toFixed(4)}`
        );


        broadcastVessel(
          vessel
        );
      } catch (error) {
        console.error(
          "[AIS] Message processing error:",
          error.message
        );
      }
    }
  );


  aisSocket.on(
    "error",
    (error) => {
      console.error(
        "[AIS] WebSocket error:",
        error.message
      );
    }
  );


  aisSocket.on(
    "close",
    (code, reason) => {
      const reasonText =
        reason &&
        reason.length
          ? reason.toString()
          : "none";


      log(
        `AISStream connection closed. ` +
        `code=${code} ` +
        `reason=${reasonText}`
      );


      aisSocket = null;

      scheduleReconnect();
    }
  );
}


/* ============================================================
   RECONNECT
   ============================================================ */

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }


  reconnectTimer =
    setTimeout(
      () => {
        reconnectTimer =
          null;

        connectAIS();
      },
      RECONNECT_DELAY_MS
    );
}


/* ============================================================
   FRONTEND WEBSOCKET
   ============================================================ */

const server =
  http.createServer(
    (request, response) => {
      if (
        request.url ===
        "/health"
      ) {
        response.writeHead(
          200,
          {
            "Content-Type":
              "application/json",
          }
        );


        response.end(
          JSON.stringify({
            ok: true,

            aisConnected:
              Boolean(
                aisSocket &&
                aisSocket.readyState ===
                  WebSocket.OPEN
              ),

            vesselCount:
              vessels.size,

            clientCount:
              clients.size,

            timestamp:
              new Date().toISOString(),
          })
        );


        return;
      }


      response.writeHead(
        404
      );

      response.end(
        "Not Found"
      );
    }
  );


const wss =
  new WebSocketServer({
    server,
  });


wss.on(
  "connection",
  (client) => {
    clients.add(client);


    log(
      `Frontend connected. ` +
      `Clients: ${clients.size}`
    );


    /*
     * Immediately send every vessel currently
     * known by the backend.
     */

    client.send(
      JSON.stringify({
        type:
          "vessel:snapshot",

        vessels:
          Array.from(
            vessels.values()
          ).map(
            serializeVessel
          ),
      })
    );


    client.on(
      "close",
      () => {
        clients.delete(client);


        log(
          `Frontend disconnected. ` +
          `Clients: ${clients.size}`
        );
      }
    );


    client.on(
      "error",
      () => {
        clients.delete(client);
      }
    );
  }
);


/* ============================================================
   REMOVE STALE VESSELS
   ============================================================ */

setInterval(
  () => {
    const cutoff =
      Date.now() -
      VESSEL_TIMEOUT_MS;


    for (
      const [
        mmsi,
        vessel,
      ] of vessels
    ) {
      if (
        vessel.lastSeen <
        cutoff
      ) {
        vessels.delete(
          mmsi
        );


        broadcast({
          type:
            "vessel:remove",

          mmsi,
        });
      }
    }
  },
  60_000
);


/* ============================================================
   START
   ============================================================ */

server.listen(
  PORT,
  () => {
    log(
      `OSIRIS AIS server listening on ${PORT}`
    );

    connectAIS();
  }
);
