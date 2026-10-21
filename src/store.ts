export const STORAGE_KEY = "daily.journal.v1";
export const CATEGORIES = ["업무", "배움", "일상", "건강"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Task = { id: string; title: string; done: boolean };
export type Entry = {
  id: string;
  text: string;
  category: Category;
  createdAt: string;
};
export type Day = {
  tasks: Task[];
  entries: Entry[];
  rating: number | null;
  reflection: string;
};
export type Journal = { version: 1; days: Record<string, Day> };

export const emptyDay = (): Day => ({
  tasks: [],
  entries: [],
  rating: null,
  reflection: "",
});
export const emptyJournal = (): Journal => ({ version: 1, days: {} });

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}
export function addDays(key: string, amount: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}
export function validDate(key: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
    key >= "2000-01-01" &&
    key <= "2100-12-31" &&
    dateKey(fromKey(key)) === key
  );
}
export function weekDates(key: string): string[] {
  const offset = (fromKey(key).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(key, i - offset));
}
export const hasContent = (day?: Day): boolean =>
  !!day &&
  (day.tasks.length > 0 ||
    day.entries.length > 0 ||
    day.rating !== null ||
    day.reflection.trim().length > 0);

export function streak(days: Record<string, Day>, today: string): number {
  let cursor = hasContent(days[today]) ? today : addDays(today, -1);
  let count = 0;
  while (hasContent(days[cursor])) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const shortText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

// Validate both saved data and imports before allowing either into application state.
export function parseJournal(raw: string): Journal {
  const value: unknown = JSON.parse(raw);
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.days) ||
    Object.keys(value.days).length > 36525
  )
    throw new Error("지원하지 않는 기록 파일입니다.");
  const days: Record<string, Day> = {};
  for (const [key, day] of Object.entries(value.days)) {
    if (
      !validDate(key) ||
      !object(day) ||
      !Array.isArray(day.tasks) ||
      !Array.isArray(day.entries) ||
      day.tasks.length > 1000 ||
      day.entries.length > 1000 ||
      !(
        day.rating === null ||
        (Number.isInteger(day.rating) &&
          Number(day.rating) >= 1 &&
          Number(day.rating) <= 5)
      ) ||
      !shortText(day.reflection, 10000)
    )
      throw new Error("기록 데이터의 형식이 올바르지 않습니다.");
    const ids = new Set<string>();
    const tasks: Task[] = day.tasks.map((task: unknown) => {
      if (
        !object(task) ||
        !shortText(task.id, 100) ||
        !task.id ||
        ids.has(task.id) ||
        !shortText(task.title, 200) ||
        !task.title.trim() ||
        typeof task.done !== "boolean"
      )
        throw new Error("할 일 데이터가 올바르지 않습니다.");
      ids.add(task.id);
      return { id: task.id, title: task.title, done: task.done };
    });
    const entries: Entry[] = day.entries.map((entry: unknown) => {
      if (
        !object(entry) ||
        !shortText(entry.id, 100) ||
        !entry.id ||
        ids.has(entry.id) ||
        !shortText(entry.text, 10000) ||
        !entry.text.trim() ||
        !CATEGORIES.includes(entry.category as Category) ||
        !shortText(entry.createdAt, 40) ||
        !Number.isFinite(Date.parse(entry.createdAt))
      )
        throw new Error("하루 기록 데이터가 올바르지 않습니다.");
      ids.add(entry.id);
      return {
        id: entry.id,
        text: entry.text,
        category: entry.category as Category,
        createdAt: entry.createdAt,
      };
    });
    days[key] = {
      tasks,
      entries,
      rating: day.rating as number | null,
      reflection: day.reflection,
    };
  }
  return { version: 1, days };
}
