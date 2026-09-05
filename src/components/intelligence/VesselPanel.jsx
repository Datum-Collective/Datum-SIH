import { Ship } from "lucide-react";
import { EvidenceButton } from "./DetectionPanel";

export default function VesselPanel({ incident, onEvidence }) {
  return (
    <div className="vessel-panel">

      <div className="vessel-main">

        <div className="ship-icon large">
          <Ship size={21} />
        </div>

        <div>
          <div className="vessel-name">
            {incident.vessel}
          </div>

          <div className="vessel-sub">
            MMSI {incident.mmsi} · {incident.vesselType}
          </div>
        </div>

        <div className="attribution-box">
          <span>ATTRIBUTION</span>
          <strong>{incident.attribution}%</strong>
        </div>

      </div>

      <EvidenceButton onClick={onEvidence} />

    </div>
  );
}
