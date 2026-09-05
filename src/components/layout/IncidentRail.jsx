import {
  Navigation,
  Satellite,
  Waves,
  Wind,
} from "lucide-react";

function DataStream({ icon, name, status }) {
  return (
    <div className="data-stream">
      <span className="data-stream-icon">
        {icon}
      </span>

      <span className="data-stream-name">
        {name}
      </span>

      <span className="data-stream-status">
        <span className="stream-dot" />
        {status}
      </span>
    </div>
  );
}

function IncidentItem({ item, selected, onClick }) {
  return (
    <button
      type="button"
      className={`incident-item ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="incident-top">
        <span className={`severity-dot ${item.severity}`} />

        <span className="incident-id">
          {item.id}
        </span>

        <span className={`severity ${item.severity}`}>
          {item.severity}
        </span>
      </div>

      <div className="incident-location">
        {item.location}
      </div>

      <div className="incident-meta">
        <span>
          DETECTED&nbsp;&nbsp;{item.time}
        </span>

        <strong>
          {item.confidence}%
        </strong>
      </div>
    </button>
  );
}

export default function IncidentRail({
  incidents,
  incident,
  selectIncident,
}) {
  return (
    <aside className="incident-rail">
      <div className="rail-section-heading">
        <span>ACTIVE INCIDENTS</span>

        <span className="incident-count">
          {String(incidents.length).padStart(2, "0")}
        </span>
      </div>

      <div className="incident-list">
        {incidents.map((item) => (
          <IncidentItem
            key={item.id}
            item={item}
            selected={incident.id === item.id}
            onClick={() => selectIncident(item)}
          />
        ))}
      </div>

      <div className="streams-section">
        <div className="rail-section-heading">
          <span>DATA SOURCES</span>
        </div>

        <div className="data-streams">
          <DataStream
            icon={<Satellite size={13} strokeWidth={1.7} />}
            name="SENTINEL-1 SAR"
            status="LIVE"
          />

          <DataStream
            icon={<Satellite size={13} strokeWidth={1.7} />}
            name="SENTINEL-2 OPTICAL"
            status="LIVE"
          />

          <DataStream
            icon={<Navigation size={13} strokeWidth={1.7} />}
            name="AIS"
            status="LIVE"
          />

          <DataStream
            icon={<Wind size={13} strokeWidth={1.7} />}
            name="METEO / ECMWF"
            status="LIVE"
          />

          <DataStream
            icon={<Waves size={13} strokeWidth={1.7} />}
            name="OCEAN CURRENT"
            status="LIVE"
          />

          <DataStream
            icon={<Wind size={13} strokeWidth={1.7} />}
            name="WIND FIELD"
            status="LIVE"
          />
        </div>
      </div>
    </aside>
  );
}
