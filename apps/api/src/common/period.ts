export type Period = "daily" | "weekly" | "monthly";

export function periodStart(period: Period, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "daily") return start;

  if (period === "weekly") {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    return start;
  }

  start.setDate(1);
  return start;
}
