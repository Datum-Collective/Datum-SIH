import { Navigation, Satellite, Waves, Wind } from "lucide-react";

function DataStream({ icon, name, status }) {
  return (
    <div className="data-stream">
      {icon}
      <span>{name}</span>
      <strong>{status}</strong>
    </div>
  );
}

export default function IncidentRail({ incidents, incident, selectIncident }) {
  return (
        <aside className="incident-rail">

          <div className="rail-heading">
            <span>ACTIVE INCIDENTS</span>
            <strong>{incidents.length}</strong>
          </div>

          <div className="incident-list">

            {incidents.map((item) => (
              <button
                key={item.id}
                className={`incident-item ${
                  incident.id === item.id ? "selected" : ""
                }`}
                onClick={() => selectIncident(item)}
              >
                <div className="incident-top">

                  <span
                    className={`severity-dot ${item.severity}`}
                  />

                  <span className="incident-id">
                    {item.id}
                  </span>

                  <span
                    className={`severity ${item.severity}`}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="incident-location">
                  {item.location}
                </div>

                <div className="incident-meta">
                  <span>Detected {item.time}</span>
                  <strong>{item.confidence}%</strong>
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
              icon={<Satellite size={13} />}
              name="SENTINEL-2 OPTICAL"
              status="LIVE"
            />

            <DataStream
              icon={<Navigation size={13} />}
              name="AIS"
              status="LIVE"
            />

            <DataStream
              icon={<Wind size={13} />}
              name="METEO (ECMWF)"
              status="LIVE"
            />

            <DataStream
              icon={<Waves size={13} />}
              name="OCEAN CURRENT"
              status="LIVE"
            />

            <DataStream
              icon={<Wind size={13} />}
              name="WIND FIELD"
              status="LIVE"
            />

          </div>

        </aside>
  );
}
