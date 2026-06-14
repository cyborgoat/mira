import { periodStart, Period } from "./period";

export function filterByPeriod<TTask, TNote>(tasks: TTask[], notes: TNote[], period: Period) {
  const start = periodStart(period);
  return {
    tasks: tasks.filter((task) => {
      const value = task as { createdAt: Date | string; completedAt: Date | string | null; dueDate?: Date | string | null };
      const createdAt = value.createdAt instanceof Date ? value.createdAt : new Date(value.createdAt);
      const completedAt = value.completedAt ? (value.completedAt instanceof Date ? value.completedAt : new Date(value.completedAt)) : null;
      const dueDate = value.dueDate ? (value.dueDate instanceof Date ? value.dueDate : new Date(value.dueDate)) : null;
      return createdAt >= start || Boolean(completedAt && completedAt >= start) || Boolean(dueDate && dueDate >= start);
    }),
    notes: notes.filter((note) => {
      const date = (note as { date: Date | string }).date;
      return (date instanceof Date ? date : new Date(date)) >= start;
    }),
  };
}
