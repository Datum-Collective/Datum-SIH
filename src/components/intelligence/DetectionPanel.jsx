import { FolderOpen, ArrowRight, Ship } from "lucide-react";

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="metric-label">
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

export function MatchBars({ incident }) {
  const values = [
    ["Spatial Match", incident.spatial],
    ["Temporal Match", incident.temporal],
    ["Trajectory Match", incident.trajectory],
    ["Heading Match", incident.heading],
    ["Behavioral Match", incident.behavioral],
  ];

  return (
    <div className="match-bars">
      {values.map(([label, value]) => (
        <div className="match-row" key={label}>
          <span>{label}</span>

          <div className="match-track">
            <div
              className="match-fill"
              style={{
                width: `${value}%`,
              }}
            />
          </div>

          <strong>{value}%</strong>
        </div>
      ))}
    </div>
  );
}

export function EvidenceButton({ onClick }) {
  return (
    <button
      className="evidence-button"
      onClick={onClick}
    >
      <FolderOpen size={15} />
      VIEW EVIDENCE
      <ArrowRight size={15} />
    </button>
  );
}

export default function DetectionPanel({ incident }) {
  return (
    <div className="detection-layout">

      <Metric
        label="DETECTED"
        value={incident.time}
      />

      <Metric
        label="SPILL AREA"
        value={incident.area}
      />

      <Metric
        label="EST. AGE"
        value={incident.age}
      />

      <Metric
        label="WIND"
        value={incident.wind}
      />

      <div className="match-vessel">

        <span className="metric-label">
          TOP VESSEL MATCH
        </span>

        <div className="vessel-inline">

          <div className="ship-icon">
            <Ship size={19} />
          </div>

          <div>
            <strong>{incident.vessel}</strong>

            <small>
              MMSI {incident.mmsi} · {incident.vesselType}
            </small>
          </div>

        </div>

      </div>

    </div>
  );
}
