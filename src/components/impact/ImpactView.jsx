import { ArrowLeft } from "lucide-react";
import ImpactCard from "./ImpactCard";

export default function ImpactView({ incident, onBack }) {
  return (
    <div className="impact-view">

      <div className="impact-view-header">

        <button
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={15} />
          BACK TO INCIDENT
        </button>

        <div>
          <span>IMPACT ASSESSMENT</span>
          <strong>
            {incident.id} · {incident.location}
          </strong>
        </div>

        <div className="impact-confidence">
          <span>DETECTION CONFIDENCE</span>
          <strong>{incident.confidence}%</strong>
        </div>

      </div>

      <div className="impact-overview">

        <ImpactCard
          icon="coast"
          label="COASTLINE"
          risk="MEDIUM RISK"
          time="+38H"
        />

        <ImpactCard
          icon="fish"
          label="FISHING ZONE"
          risk="HIGH RISK"
          time="+26H"
        />

        <ImpactCard
          icon="port"
          label="PORT FACILITY"
          risk="LOW RISK"
          time="+51H"
        />

      </div>

      <div className="impact-analysis">

        <div className="impact-section">

          <span className="metric-label">
            PREDICTED IMPACT
          </span>

          <h2>
            Fishing zone exposure
          </h2>

          <p>
            Current drift modelling indicates
            elevated probability of oil reaching
            the identified fishing zone within
            approximately 26 hours.
          </p>

        </div>

        <div className="impact-section">

          <span className="metric-label">
            RESPONSE PRIORITY
          </span>

          <div className="priority-critical">
            HIGH
          </div>

          <p>
            Prioritise containment planning for
            the forecast corridor and monitor
            coastal exposure.
          </p>

        </div>

      </div>

      <div className="impact-bottom">

        <span>
          FORECAST MODEL
        </span>

        <strong>GNOME</strong>

        <span>
          RUN 02 JUN 2025 14:00 UTC
        </span>

      </div>

    </div>
  );
}
