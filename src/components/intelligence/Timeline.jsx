import { Activity, ArrowLeft } from "lucide-react";
export default function Timeline({
  incident,
  timelineStep,
  setTimelineStep,
  onImpact,
}) {
  const times = [
    [0, "NOW", incident.time],
    [1, "+6H", "20:12 UTC"],
    [2, "+12H", "02:12 UTC"],
    [3, "+24H", "14:12 UTC"],
    [4, "+48H", "14:12 UTC"],
  ];

  return (
    <div className="event-timeline">

      <div className="timeline-label">
        <Activity size={12} />
        EVENT TIMELINE
      </div>

      <div className="timeline-controls">

        <button
          onClick={() =>
            setTimelineStep(
              Math.max(0, timelineStep - 1)
            )
          }
        >
          <ArrowLeft size={14} />
        </button>

      </div>

      <div className="timeline">

        <div className="timeline-base" />

        <div
          className="timeline-progress"
          style={{
            width: `${timelineStep * 25}%`,
          }}
        />

        {times.map(([index, label, time]) => (

          <button
            className={`timeline-point ${
              timelineStep === index
                ? "active"
                : ""
            }`}
            key={label}
            onClick={() => setTimelineStep(index)}
          >

            <span />

            <strong>{label}</strong>

            <small>{time}</small>

          </button>

        ))}

      </div>

      <div className="forecast-model">

        <span>FORECAST MODEL</span>
        <strong>GNOME</strong>
        <small>
          Run 02 Jun 2025 14:00 UTC
        </small>

      </div>


    </div>
  );
}
