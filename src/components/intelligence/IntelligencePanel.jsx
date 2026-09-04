import { AlertTriangle, ChevronRight } from "lucide-react";
import DetectionPanel from "./DetectionPanel";
import VesselPanel from "./VesselPanel";
import ForecastPanel from "./ForecastPanel";
import ImpactPanel from "./ImpactPanel";
import Timeline from "./Timeline";

function RelationshipNode({ label, active }) {
  return (
    <div className={`relationship-node ${active ? "active" : ""}`}>
      <span className="relationship-dot" />
      {label}
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

        <div className="intel-header">

          <div className="active-incident">

            <div className="alert-icon">
              <AlertTriangle size={17} />
            </div>

            <div>

              <div className="intel-kicker">
                ACTIVE INCIDENT
              </div>

              <div className="intel-title-row">

                <strong>{incident.id}</strong>

                <span>{incident.location}</span>

                <i />

                <span>{incident.time}</span>

              </div>

            </div>
          </div>

          <div className="confidence">

            <span>DETECTION CONFIDENCE</span>

            <strong>{incident.confidence}%</strong>

          </div>

        </div>

        {/* RELATIONSHIP */}

        <div className="relationship">

          <RelationshipNode
            active
            label="SPILL"
          />

          <ChevronRight />

          <RelationshipNode label="SOURCE" />

          <ChevronRight />

          <RelationshipNode label="VESSEL" />

          <ChevronRight />

          <RelationshipNode label="TRAJECTORY" />

          <ChevronRight />

          <RelationshipNode label="IMPACT" />

        </div>

        {/* TABS */}

        <div className="intel-tabs">

          {[
            "detection",
            "vessels",
            "forecast",
            "impact",
          ].map((tab) => (

            <button
              key={tab}
              className={
                activeTab === tab ? "active" : ""
              }
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>

          ))}

        </div>

        {/* CONTENT */}

        <div className="intel-content">

          {activeTab === "detection" && (
            <DetectionPanel
              incident={incident}
              onEvidence={() =>
                setShowEvidence(true)
              }
            />
          )}

          {activeTab === "vessels" && (
            <VesselPanel
              incident={incident}
              onEvidence={() =>
                setShowEvidence(true)
              }
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

        {/* TIMELINE */}

        <Timeline
          incident={incident}
          timelineStep={timelineStep}
          setTimelineStep={setTimelineStep}
          onImpact={() => setShowImpact(true)}
        />

      </section>
  );
}
