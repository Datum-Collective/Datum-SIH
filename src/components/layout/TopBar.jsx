import { Activity, Waves } from "lucide-react";

export default function TopBar({ impactView = false }) {
  return impactView ? (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Waves size={17} />
        </div>
        <div>
          <div className="brand-name">
            OIL<span>SENTINEL</span>
          </div>
          <div className="brand-subtitle">
            MARITIME ENVIRONMENTAL INTELLIGENCE
          </div>
        </div>
      </div>
      <div className="system-status">
        <span className="live-dot" />
        <span>LIVE</span>
        <i />
        <span>UTC</span>
        <span>14:32:18</span>
      </div>
      <div className="top-actions">
        <span>OPERATIONS</span>
        <button>
          <Activity size={15} />
        </button>
      </div>
    </header>
  ) : (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Waves size={17} />
        </div>
        <div>
          <div className="brand-name">
            OIL<span>SENTINEL</span>
          </div>
          <div className="brand-subtitle">
            MARITIME ENVIRONMENTAL INTELLIGENCE
          </div>
        </div>
      </div>
      <div className="system-status">
        <span className="live-dot" />
        <span>LIVE</span>
        <i />
        <span>UTC</span>
        <span>14:32:18</span>
        <i />
        <span>02 JUN 2025</span>
      </div>
      <div className="top-actions">
        <span>OPERATIONS</span>
        <button>
          <Activity size={15} />
        </button>
        <button>
          <span className="hamburger">☰</span>
        </button>
      </div>
    </header>
  );
}
