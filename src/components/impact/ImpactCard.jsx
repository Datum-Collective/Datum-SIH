import { AlertTriangle, Navigation, Waves } from "lucide-react";

export default function ImpactCard({
  icon,
  label,
  risk,
  time,
}) {
  return (
    <div className="impact-card">

      <div className={`impact-icon ${icon}`}>
        {icon === "coast" && (
          <AlertTriangle size={17} />
        )}

        {icon === "fish" && (
          <Waves size={17} />
        )}

        {icon === "port" && (
          <Navigation size={17} />
        )}
      </div>

      <div>
        <span>{label}</span>
        <strong>{risk}</strong>
      </div>

      <small>{time}</small>

    </div>
  );
}
