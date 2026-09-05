import { AlertTriangle, ChevronRight } from "lucide-react";
import DetectionPanel from "./DetectionPanel";
import VesselPanel from "./VesselPanel";
import ForecastPanel from "./ForecastPanel";
import ImpactPanel from "./ImpactPanel";
import Timeline from "./Timeline";

const tabs = [
  ["detection", "DETECTION"],
  ["vessels", "VESSELS"],
  ["forecast", "FORECAST"],
  ["impact", "IMPACT"],
];

function RelationshipNode({ label, active }) {
  return (
    <div className={`relationship-node ${active ? "active" : ""}`}>
      <span className="relationship-dot" />
      <span>{label}</span>
    </div>
  );
}

function RelationshipChain() {
  return (
    <div className="relationship">
      <RelationshipNode label="SPILL" active />

      <ChevronRight />

      <RelationshipNode label="SOURCE" />

      <ChevronRight />

      <RelationshipNode label="VESSEL" />

      <ChevronRight />

      <RelationshipNode label="TRAJECTORY" />

      <ChevronRight />

      <RelationshipNode label="IMPACT" />
    </div>
  );
}

export default function IntelligencePanel({
  incident,
  activeTab,
  setActiveTab,
  timelineStep,
  setTimelineStep,
  setShowEvidence,
  setShowImpact,
}) {
  return (
    <section className="intel-panel">
      {/* =====================================================
          INCIDENT HEADER
          ===================================================== */}

      <div className="intel-header">
        <div className="active-incident">
          <div className="alert-icon">
            <AlertTriangle size={16} strokeWidth={1.8} />
          </div>

          <div className="active-incident-copy">
            <div className="intel-kicker">
              ACTIVE ENVIRONMENTAL INCIDENT
            </div>

            <div className="intel-title-row">
              <strong>{incident.id}</strong>

              <span className="intel-location">
                {incident.location}
              </span>

              <i />

              <span className="intel-time">
                DETECTED {incident.time}
              </span>
            </div>
          </div>
        </div>

        <div className="confidence">
          <span>DETECTION CONFIDENCE</span>

          <div className="confidence-value">
            <strong>{incident.confidence}%</strong>
          </div>
        </div>
      </div>

      {/* =====================================================
          RELATIONSHIP CHAIN
          ===================================================== */}

      <RelationshipChain />

      {/* =====================================================
          ANALYSIS TABS
          ===================================================== */}

      <div className="intel-tabs">
        <div className="intel-tabs-inner">
          {tabs.map(([tab, label]) => (
            <button
              type="button"
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="tab-context">
          CASE {incident.id}
        </div>
      </div>

      {/* =====================================================
          CONTENT
          ===================================================== */}

      <div className="intel-content">
        {activeTab === "detection" && (
          <DetectionPanel
            incident={incident}
            onEvidence={() => setShowEvidence(true)}
          />
        )}

        {activeTab === "vessels" && (
          <VesselPanel
            incident={incident}
            onEvidence={() => setShowEvidence(true)}
          />
        )}

        {activeTab === "forecast" && (
          <ForecastPanel
            incident={incident}
            timelineStep={timelineStep}
            setTimelineStep={setTimelineStep}
          />
        )}

        {activeTab === "impact" && (
          <ImpactPanel
            incident={incident}
            onOpen={() => setShowImpact(true)}
          />
        )}
      </div>

      {/* =====================================================
          TIMELINE
          ===================================================== */}

      <Timeline
        incident={incident}
        timelineStep={timelineStep}
        setTimelineStep={setTimelineStep}
        onImpact={() => setShowImpact(true)}
      />
    </section>
  );
}
