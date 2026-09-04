import { AlertTriangle } from "lucide-react";

export default function EvidenceModal({ incident, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >

      <div
        className="evidence-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <div className="modal-header">

          <div>
            <span>INVESTIGATION EVIDENCE</span>
            <h2>{incident.id}</h2>
          </div>

          <button onClick={onClose}>
            ×
          </button>

        </div>

        <div className="evidence-grid">

          <EvidenceItem
            label="SATELLITE SOURCE"
            value="Sentinel-1 SAR"
            status="VERIFIED"
          />

          <EvidenceItem
            label="DETECTION TIME"
            value={incident.time}
            status="MATCHED"
          />

          <EvidenceItem
            label="SPILL AREA"
            value={incident.area}
            status="DETECTED"
          />

          <EvidenceItem
            label="TOP AIS CANDIDATE"
            value={incident.vessel}
            status={`${incident.attribution}% MATCH`}
          />

        </div>

        <div className="evidence-note">

          <AlertTriangle size={16} />

          <div>
            <strong>
              Attribution is probabilistic.
            </strong>

            <p>
              Vessel ranking combines spatial,
              temporal, trajectory, heading and
              behavioural evidence. It does not
              constitute proof of responsibility.
            </p>
          </div>

        </div>

        <button
          className="modal-close"
          onClick={onClose}
        >
          CLOSE EVIDENCE
        </button>

      </div>
    </div>
  );
}

function EvidenceItem({
  label,
  value,
  status,
}) {
  return (
    <div className="evidence-item">

      <span>{label}</span>

      <strong>{value}</strong>

      <small>{status}</small>

    </div>
  );
}
