import { Activity, ArrowRight } from "lucide-react";
import ImpactCard from "../impact/ImpactCard";

export default function ImpactPanel({ incident, onOpen }) {
  return (
    <div className="impact-panel">

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

      <button
        className="impact-open"
        onClick={onOpen}
      >
        <Activity size={15} />
        IMPACT ASSESSMENT
        <ArrowRight size={15} />
      </button>

    </div>
  );
}
