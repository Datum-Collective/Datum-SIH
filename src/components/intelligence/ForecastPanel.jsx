export default function ForecastPanel({
  incident,
  timelineStep,
  setTimelineStep,
}) {
  const stages = [
    ["NOW", incident.time],
    ["+6H", "20:12 UTC"],
    ["+12H", "02:12 UTC"],
    ["+24H", "14:12 UTC"],
    ["+48H", "14:12 UTC"],
  ];

  return (
    <div className="forecast-panel">

      <div className="forecast-summary">

        <div>
          <span className="metric-label">
            FORECAST MODEL
          </span>
          <strong>GNOME</strong>
        </div>

        <div>
          <span className="metric-label">
            CURRENT
          </span>
          <strong>{incident.current}</strong>
        </div>

        <div>
          <span className="metric-label">
            WIND
          </span>
          <strong>{incident.wind}</strong>
        </div>

      </div>

      <div className="forecast-timeline">

        {stages.map(([label, time], index) => (

          <button
            key={label}
            className={
              timelineStep === index
                ? "selected"
                : ""
            }
            onClick={() =>
              setTimelineStep(index)
            }
          >

            <span>{label}</span>
            <small>{time}</small>

          </button>

        ))}

      </div>

      <div className="forecast-status">

        <span>
          PREDICTED DRIFT
        </span>

        <strong>
          {timelineStep === 0
            ? "CURRENT POSITION"
            : `FORECAST +${timelineStep === 1
              ? 6
              : timelineStep === 2
              ? 12
              : timelineStep === 3
              ? 24
              : 48}H`}
        </strong>

      </div>

    </div>
  );
}
