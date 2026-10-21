import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dateKey, fromKey, hasContent, validDate } from "./store";
import type { Day } from "./store";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const keyboardOffsets: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};
const labelFor = (key: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(fromKey(key));

function shiftMonth(month: string, offset: number) {
  const date = fromKey(`${month}-01`);
  date.setMonth(date.getMonth() + offset);
  return dateKey(date).slice(0, 7);
}

export default function MonthCalendar({
  month,
  selected,
  today,
  days,
  onMonthChange,
  onSelect,
}: {
  month: string;
  selected: string;
  today: string;
  days: Record<string, Day>;
  onMonthChange: (month: string) => void;
  onSelect: (key: string) => void;
}) {
  const first = fromKey(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + length) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= length
        ? `${month}-${String(day).padStart(2, "0")}`
        : null;
    },
  );
  const recorded = cells.filter((key) => key && hasContent(days[key])).length;

  return (
    <section className="month-calendar" aria-label="월간 달력">
      <div className="calendar-toolbar">
        <h2 aria-live="polite">
          {first.getFullYear()}년 {first.getMonth() + 1}월
        </h2>
        <div className="calendar-controls">
          <button
            className="calendar-current"
            onClick={() => onMonthChange(today.slice(0, 7))}
          >
            이번 달
          </button>
          <button
            className="icon-button"
            aria-label="이전 달"
            disabled={month <= "2000-01"}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="다음 달"
            disabled={month >= "2100-12"}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((day, index) => (
          <span
            key={day}
            className={index === 6 ? "sunday" : index === 5 ? "saturday" : ""}
          >
            {day}
          </span>
        ))}
      </div>
      <div
        className="calendar-dates"
        role="group"
        aria-label={`${first.getFullYear()}년 ${first.getMonth() + 1}월 날짜`}
      >
        {cells.map((key, index) =>
          key ? (
            <button
              key={key}
              data-calendar-date={key}
              className={`calendar-day ${selected === key ? "selected" : ""} ${today === key ? "is-today" : ""} ${index % 7 === 6 ? "sunday" : index % 7 === 5 ? "saturday" : ""}`}
              aria-label={`${labelFor(key)}${hasContent(days[key]) ? ", 기록 있음" : ""}`}
              aria-pressed={selected === key}
              aria-current={today === key ? "date" : undefined}
              onClick={() => onSelect(key)}
              onKeyDown={(event) => {
                const distance = keyboardOffsets[event.key];
                if (distance === undefined) return;
                event.preventDefault();
                const next = addDays(key, distance);
                if (!validDate(next)) return;
                onSelect(next);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLButtonElement>(
                      `[data-calendar-date="${next}"]`,
                    )
                    ?.focus(),
                );
              }}
            >
              <span className="calendar-day-number">
                {fromKey(key).getDate()}
              </span>
              {today === key && (
                <span className="calendar-today-label">오늘</span>
              )}
              {hasContent(days[key]) && (
                <span className="calendar-record">
                  <span className="calendar-record-dot" />
                  {days[key].entries.length > 0 && (
                    <span className="calendar-record-count">
                      {days[key].entries.length}건
                    </span>
                  )}
                </span>
              )}
            </button>
          ) : (
            <span
              key={`empty-${index}`}
              className="calendar-empty"
              aria-hidden="true"
            />
          ),
        )}
      </div>
      <div className="calendar-summary">
        <span>
          <span className="calendar-record-dot" />
          기록 있음
        </span>
        <span>이달 기록 {recorded}일</span>
      </div>
    </section>
  );
}
