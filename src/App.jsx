import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./styles/osiris.css";
import "./App.css";
import "./styles/oil-sentinel-theme.css";

import { incidents } from "./data/incidents";

import TopBar from "./components/layout/TopBar";
import IncidentRail from "./components/layout/IncidentRail";
import MapView from "./components/map/MapView";
import IntelligencePanel from "./components/intelligence/IntelligencePanel";
import EvidenceModal from "./components/intelligence/EvidenceModal";
import ImpactView from "./components/impact/ImpactView";

export default function App() {
  const [selectedIncident, setSelectedIncident] = useState(incidents[0]);
  const [mapMode, setMapMode] = useState("chart");
  const [activeTab, setActiveTab] = useState("detection");
  const [showEvidence, setShowEvidence] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);

  const incident = selectedIncident;

  const selectIncident = (item) => {
    setSelectedIncident(item);
    setActiveTab("detection");
    setShowEvidence(false);
    setShowImpact(false);
    setTimelineStep(0);
  };

  const mapCenter = useMemo(
    () => [incident.lat, incident.lng],
    [incident]
  );

  if (showImpact) {
    return (
      <div className="app">
        <TopBar impactView />

        <ImpactView
          incident={incident}
          onBack={() => setShowImpact(false)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar />

      <main className="workspace">
        <IncidentRail
          incidents={incidents}
          incident={incident}
          selectIncident={selectIncident}
        />

        <MapView
          incident={incident}
          incidents={incidents}
          mapMode={mapMode}
          setMapMode={setMapMode}
          selectIncident={selectIncident}
          mapCenter={mapCenter}
        />
      </main>

      <IntelligencePanel
        incident={incident}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timelineStep={timelineStep}
        setTimelineStep={setTimelineStep}
        setShowEvidence={setShowEvidence}
        setShowImpact={setShowImpact}
      />

      {showEvidence && (
        <EvidenceModal
          incident={incident}
          onClose={() => setShowEvidence(false)}
        />
      )}
    </div>
  );
}
