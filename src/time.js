export function formatIncidentTime(date) {
  const timeZone = process.env.TZ || "Europe/Malta";
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
  return `${formatted} (${timeZone})`;
}
