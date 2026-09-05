export default function ForecastPanel({ incident }) {
  return (
    <div className="forecast-panel">
      <div className="forecast-card">
        <div className="forecast-card-header">
          <span>OCEAN DRIFT FORECAST</span>
          <small>MODEL</small>
        </div>

        <strong className="forecast-value">
          GNOME
        </strong>
      </div>

      <div className="forecast-card">
        <div className="forecast-card-header">
          <span>CURRENT POSITION</span>
          <small>OBSERVED</small>
        </div>

        <strong className="forecast-value">
          {incident.current}
        </strong>
      </div>

      <div className="forecast-card">
        <div className="forecast-card-header">
          <span>SURFACE WIND</span>
          <small>LOCAL CONDITIONS</small>
        </div>

        <strong className="forecast-value">
          {incident.wind}
        </strong>
      </div>
    </div>
  );
}
