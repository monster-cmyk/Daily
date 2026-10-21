import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  CircleHelp,
  CloudOff,
  Download,
  Flame,
  Leaf,
  Pencil,
  Plus,
  Smile,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  dateKey,
  emptyDay,
  emptyJournal,
  fromKey,
  hasContent,
  parseJournal,
  STORAGE_KEY,
  streak,
  validDate,
  weekDates,
} from "./store";
import type { Category, Day, Entry, Journal } from "./store";
import MonthCalendar from "./MonthCalendar";

const moods = ["매우 나쁨", "나쁨", "보통", "좋음", "매우 좋음"].map(
  (label) => ({ label }),
);
const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const monthDay = (key: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(
    fromKey(key),
  );

function load(): { journal: Journal; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { journal: raw ? parseJournal(raw) : emptyJournal(), error: null };
  } catch {
    return {
      journal: emptyJournal(),
      error:
        "저장된 기록을 읽지 못했어요. 원래 데이터 보호를 위해 자동 저장을 멈췄습니다. 데이터 관리에서 원본을 백업한 뒤 올바른 백업을 불러오세요.",
    };
  }
}

export default function App() {
  const [initial] = useState(load);
  const [journal, setJournal] = useState(initial.journal);
  const [readError, setReadError] = useState(initial.error);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [selected, setSelected] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState<"daily" | "review">("daily");
  const [taskText, setTaskText] = useState("");
  const [entryText, setEntryText] = useState("");
  const [category, setCategory] = useState<Category>("업무");
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState<"data" | "help" | null>(null);
  const [toast, setToast] = useState("");
  const [pendingImport, setPendingImport] = useState<Journal | null>(null);
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const entryInput = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const day = journal.days[selected] ?? emptyDay();
  const week = weekDates(selected);
  const completed = day.tasks.filter((task) => task.done).length;
  const progress = day.tasks.length
    ? Math.round((completed / day.tasks.length) * 100)
    : 0;
  const recordedDays = Object.values(journal.days).filter(hasContent).length;

  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(dateKey(new Date())),
      30_000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (readError) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
      setSaveError(null);
    } catch {
      setSaveError(
        "기록을 저장하지 못했어요. 브라우저 저장 공간을 확인하고, 데이터 관리에서 기록을 백업해주세요.",
      );
    }
  }, [journal, readError]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!entryText.trim()) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [entryText]);
  useEffect(() => {
    if (modal) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [modal]);

  function updateDay(update: (current: Day) => Day) {
    setJournal((current) => ({
      ...current,
      days: {
        ...current.days,
        [selected]: update(current.days[selected] ?? emptyDay()),
      },
    }));
  }
  function chooseDate(key: string) {
    if (!validDate(key)) return;
    if (key === selected) {
      setCalendarMonth(key.slice(0, 7));
      return;
    }
    if (
      key !== selected &&
      entryText.trim() &&
      !window.confirm(
        "아직 남기지 않은 기록이 있어요. 날짜를 바꾸면 작성 중인 내용이 사라집니다. 이동할까요?",
      )
    )
      return;
    setSelected(key);
    setCalendarMonth(key.slice(0, 7));
    setTaskText("");
    setEntryText("");
    setEditing(null);
  }
  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskText.trim() || day.tasks.length >= 1000) return;
    updateDay((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        { id: crypto.randomUUID(), title: taskText.trim(), done: false },
      ],
    }));
    setTaskText("");
  }
  function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!entryText.trim() || (!editing && day.entries.length >= 1000)) return;
    updateDay((current) => ({
      ...current,
      entries: editing
        ? current.entries.map((entry) =>
            entry.id === editing
              ? { ...entry, text: entryText.trim(), category }
              : entry,
          )
        : [
            ...current.entries,
            {
              id: crypto.randomUUID(),
              text: entryText.trim(),
              category,
              createdAt: new Date().toISOString(),
            },
          ],
    }));
    setEntryText("");
    setEditing(null);
    setToast(editing ? "기록을 수정했습니다." : "기록을 저장했습니다.");
  }
  function editEntry(entry: Entry) {
    if (
      entryText.trim() &&
      !window.confirm("작성 중인 내용을 버리고 이 기록을 수정할까요?")
    )
      return;
    setEditing(entry.id);
    setEntryText(entry.text);
    setCategory(entry.category);
    entryInput.current?.focus();
    entryInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function deleteEntry(id: string) {
    if (
      !window.confirm("이 기록을 삭제할까요? 삭제한 기록은 되돌릴 수 없어요.")
    )
      return;
    updateDay((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    }));
    if (editing === id) {
      setEditing(null);
      setEntryText("");
    }
    setToast("기록을 삭제했어요.");
  }
  function download() {
    try {
      const raw = readError
        ? localStorage.getItem(STORAGE_KEY)
        : JSON.stringify(journal, null, 2);
      if (!raw) throw new Error("백업할 원본을 읽을 수 없어요.");
      const url = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `daily-backup-${today}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast("백업 파일을 다운로드했어요.");
    } catch {
      setImportError(
        "백업 파일을 만들지 못했어요. 브라우저의 저장 공간 접근 권한을 확인해주세요.",
      );
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImportError("");
    setPendingImport(null);
    if (fileInput.current) fileInput.current.value = "";
    if (file.size > 10 * 1024 * 1024) {
      setImportError("10MB 이하의 백업 파일을 선택해주세요.");
      return;
    }
    try {
      setPendingImport(parseJournal(await file.text()));
    } catch {
      setImportError(
        "올바른 daily. 백업 파일이 아니에요. 기존 기록은 그대로 유지됩니다.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function confirmImport() {
    if (!pendingImport) return;
    // Commit to browser storage before changing state, so a quota/access failure never replaces the current journal.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingImport));
    } catch {
      setImportError(
        "저장 공간이 부족하거나 접근이 차단되어 가져오지 못했어요. 기존 기록은 그대로 유지됩니다.",
      );
      return;
    }
    setJournal(pendingImport);
    setPendingImport(null);
    setReadError(null);
    setSaveError(null);
    setEntryText("");
    setEditing(null);
    setTaskText("");
    setModal(null);
    setToast("백업 기록을 불러왔어요.");
  }
  function openDay(key: string) {
    chooseDate(key);
    setView("daily");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView("daily");
          }}
          aria-label="daily 홈"
        >
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          daily<span className="brand-dot">.</span>
        </a>

        <nav aria-label="주 메뉴">
          <button
            className={`nav-item ${view === "daily" ? "active" : ""}`}
            onClick={() => setView("daily")}
            aria-current={view === "daily" ? "page" : undefined}
          >
            <BookOpen size={19} />
            하루 기록
            <span className="nav-active-dot" />
          </button>
          <button
            className={`nav-item ${view === "review" ? "active" : ""}`}
            onClick={() => setView("review")}
            aria-current={view === "review" ? "page" : undefined}
          >
            <ChartNoAxesCombined size={19} />
            돌아보기
            <span className="nav-active-dot" />
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => {
              setPendingImport(null);
              setImportError("");
              setModal("data");
            }}
          >
            <ArrowDownToLine size={17} />
            데이터 관리
          </button>
          <button onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            daily. 사용 안내
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span>DAILY</span>
          <div
            className={`storage-state ${readError || saveError ? "error" : ""}`}
            role="status"
          >
            {readError || saveError ? (
              <CloudOff size={14} />
            ) : (
              <CheckCheck size={14} />
            )}
            {readError || saveError
              ? "저장 상태 확인 필요"
              : "이 브라우저에 저장됨"}
          </div>
        </header>
        <main>
          {(readError || saveError) && (
            <div className="error-banner" role="alert">
              {readError || saveError}
              <button onClick={() => setModal("data")}>데이터 관리 열기</button>
            </div>
          )}
          <section className="page-heading">
            <h1>{view === "daily" ? "하루 기록" : "주간 통계"}</h1>
            <div className="heading-date">
              <CalendarDays size={16} />
              <input
                aria-label="기록 날짜 선택"
                type="date"
                value={selected}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(event) => chooseDate(event.target.value)}
              />
              <button onClick={() => chooseDate(today)}>오늘</button>
            </div>
          </section>

          <MonthCalendar
            month={calendarMonth}
            selected={selected}
            today={today}
            days={journal.days}
            onMonthChange={setCalendarMonth}
            onSelect={chooseDate}
          />

          {view === "daily" ? (
            <>
              <div className="day-heading">
                <h2>
                  {monthDay(selected)}의 기록{" "}
                  <span>
                    {selected === today
                      ? "TODAY"
                      : fromKey(selected).toLocaleDateString("ko-KR", {
                          weekday: "long",
                        })}
                  </span>
                </h2>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-icon green">
                    <CheckCheck size={21} />
                  </span>
                  <div>
                    <span className="stat-label">완료한 할 일</span>
                    <strong>
                      {completed}
                      <small> / {day.tasks.length}</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon peach">
                    <Pencil size={19} />
                  </span>
                  <div>
                    <span className="stat-label">남긴 기록</span>
                    <strong>
                      {day.entries.length}
                      <small> 개</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon lavender">
                    <Flame size={20} />
                  </span>
                  <div>
                    <span className="stat-label">연속 기록</span>
                    <strong>
                      {streak(journal.days, today)}
                      <small> 일</small>
                    </strong>
                  </div>
                  <span className="stat-foot">
                    오늘 기준 · 총 {recordedDays}일 기록
                  </span>
                </div>
              </div>

              <div className="content-grid">
                <div className="primary-column">
                  <section className="card tasks-card">
                    <div className="card-heading">
                      <div>
                        <span className="section-icon">
                          <CheckCheck size={19} />
                        </span>
                        <h3>오늘의 할 일</h3>
                        <span className="count-badge">{day.tasks.length}</span>
                      </div>
                      <span className="completion-label">{progress}% 완료</span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label="할 일 완료율"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <ul className="task-list">
                      {day.tasks.map((task) => (
                        <li key={task.id} className={task.done ? "done" : ""}>
                          <label>
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() =>
                                updateDay((current) => ({
                                  ...current,
                                  tasks: current.tasks.map((item) =>
                                    item.id === task.id
                                      ? { ...item, done: !item.done }
                                      : item,
                                  ),
                                }))
                              }
                            />
                            <span className="custom-checkbox">
                              <Check size={12} />
                            </span>
                            <span className="task-title">{task.title}</span>
                          </label>
                          <button
                            className="icon-button delete-task"
                            aria-label={`${task.title} 삭제`}
                            onClick={() =>
                              updateDay((current) => ({
                                ...current,
                                tasks: current.tasks.filter(
                                  (item) => item.id !== task.id,
                                ),
                              }))
                            }
                          >
                            <X size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {!day.tasks.length && (
                      <div className="empty-tasks">
                        <p>등록된 할 일이 없습니다.</p>
                      </div>
                    )}
                    <form className="task-form" onSubmit={addTask}>
                      <Plus size={17} />
                      <input
                        aria-label="새 할 일"
                        placeholder="할 일 입력"
                        value={taskText}
                        maxLength={200}
                        onChange={(event) => setTaskText(event.target.value)}
                        disabled={day.tasks.length >= 1000}
                      />
                      <button
                        type="submit"
                        disabled={!taskText.trim() || day.tasks.length >= 1000}
                      >
                        추가
                      </button>
                    </form>
                  </section>

                  <section className="card journal-card">
                    <div className="card-heading">
                      <div>
                        <span className="section-icon">
                          <Pencil size={18} />
                        </span>
                        <h3>하루 기록</h3>
                        <span className="count-badge">
                          {day.entries.length}
                        </span>
                      </div>
                    </div>
                    <form
                      className={`entry-form ${editing ? "is-editing" : ""}`}
                      onSubmit={saveEntry}
                    >
                      {editing && (
                        <div className="editing-label">
                          <Pencil size={12} />
                          기록 수정 중
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(null);
                              setEntryText("");
                            }}
                          >
                            취소
                          </button>
                        </div>
                      )}
                      <label className="sr-only" htmlFor="entry-text">
                        하루 기록
                      </label>
                      <textarea
                        ref={entryInput}
                        id="entry-text"
                        value={entryText}
                        onChange={(event) => setEntryText(event.target.value)}
                        placeholder={"한 일과 메모를 입력하세요."}
                        maxLength={10000}
                        rows={4}
                      />
                      <div className="entry-toolbar">
                        <div className="category-pills" aria-label="기록 분류">
                          {CATEGORIES.map((item) => (
                            <button
                              type="button"
                              key={item}
                              className={category === item ? "selected" : ""}
                              aria-pressed={category === item}
                              onClick={() => setCategory(item)}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={
                            !entryText.trim() ||
                            (!editing && day.entries.length >= 1000)
                          }
                        >
                          {editing ? "수정 저장" : "기록 남기기"}
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </form>
                    <div className="entries">
                      {day.entries.length ? (
                        [...day.entries].reverse().map((entry) => (
                          <article className="entry" key={entry.id}>
                            <div className="entry-dot" />
                            <div className="entry-content">
                              <div className="entry-meta">
                                <span
                                  className={`category-tag tag-${CATEGORIES.indexOf(entry.category)}`}
                                >
                                  {entry.category}
                                </span>
                                <time dateTime={entry.createdAt}>
                                  {new Date(entry.createdAt).toLocaleTimeString(
                                    "ko-KR",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    },
                                  )}
                                </time>
                                <div className="entry-actions">
                                  <button
                                    className="icon-button"
                                    aria-label="기록 수정"
                                    onClick={() => editEntry(entry)}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    aria-label="기록 삭제"
                                    onClick={() => deleteEntry(entry.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <p>{entry.text}</p>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="empty-entries">
                          <p>등록된 기록이 없습니다.</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="secondary-column">
                  <section className="card reflection-card">
                    <div className="card-heading">
                      <div>
                        <span className="section-icon">
                          <Smile size={19} />
                        </span>
                        <h3>하루 평가</h3>
                      </div>
                    </div>
                    <div
                      className="mood-picker"
                      role="group"
                      aria-label="하루 평가"
                    >
                      {moods.map((mood, i) => (
                        <button
                          key={mood.label}
                          className={day.rating === i + 1 ? "selected" : ""}
                          aria-label={mood.label}
                          aria-pressed={day.rating === i + 1}
                          onClick={() =>
                            updateDay((current) => ({
                              ...current,
                              rating: current.rating === i + 1 ? null : i + 1,
                            }))
                          }
                        >
                          <span>{i + 1}</span>
                          <small>{mood.label}</small>
                        </button>
                      ))}
                    </div>
                    <div className="mood-caption">
                      {day.rating ? moods[day.rating - 1].label : "평가 미선택"}
                    </div>
                    <div className="reflection-divider" />
                    <label className="reflection-label" htmlFor="reflection">
                      회고
                    </label>
                    <textarea
                      id="reflection"
                      aria-label="회고"
                      rows={5}
                      maxLength={10000}
                      value={day.reflection}
                      placeholder={
                        "잘한 점, 개선할 점, 다음 계획을 입력하세요."
                      }
                      onChange={(event) =>
                        updateDay((current) => ({
                          ...current,
                          reflection: event.target.value,
                        }))
                      }
                    />
                    <div className="autosave-note">
                      <Check size={12} />
                      {readError || saveError
                        ? "저장 상태를 확인해주세요"
                        : "자동 저장"}
                    </div>
                  </section>

                  <button
                    className="review-link"
                    onClick={() => setView("review")}
                  >
                    <span>
                      <ChartNoAxesCombined size={16} />
                      주간 통계 보기
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Review journal={journal} dates={week} onOpenDay={openDay} />
          )}
        </main>
      </div>

      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setModal(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="modal-content">
          <button
            className="modal-close icon-button"
            aria-label="닫기"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal === "help" ? (
            <>
              <div className="modal-symbol">
                <Leaf size={26} />
              </div>
              <h2 id="dialog-title">사용 안내</h2>
              <p>날짜별 할 일, 기록, 평가와 회고를 관리합니다.</p>
              <ol className="help-steps">
                <li>
                  <strong>할 일 관리</strong>
                  <span>할 일을 추가하고 완료 여부를 체크합니다.</span>
                </li>
                <li>
                  <strong>기록 작성</strong>
                  <span>날짜를 선택해 기록을 작성하고 수정·삭제합니다.</span>
                </li>
                <li>
                  <strong>평가 및 회고</strong>
                  <span>
                    하루를 1~5점으로 평가하고 회고를 작성합니다. 돌아보기에서
                    주간 통계를 확인합니다.
                  </span>
                </li>
              </ol>
              <div className="privacy-note">
                <CloudOff size={18} />
                <p>
                  기록은 <strong>현재 기기의 이 브라우저에만</strong> 저장돼요.
                  계정·서버 동기화나 AI 분석 기능은 없어요. 다른 기기로 옮기거나
                  브라우저 데이터를 지우기 전에는 꼭 백업해주세요.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="modal-symbol">
                <Download size={25} />
              </div>
              <h2 id="dialog-title">데이터 관리</h2>
              <p>
                기록은 이 브라우저에만 저장됩니다. 정기적으로 백업해두면 다른
                기기에서도 이어갈 수 있어요.
              </p>
              <button className="data-action" onClick={download}>
                <Download size={21} />
                <span>
                  <strong>
                    {readError ? "저장된 원본 백업하기" : "전체 기록 백업하기"}
                  </strong>
                  <small>
                    {readError
                      ? "읽지 못한 원본 데이터를 그대로 내려받아요"
                      : `${recordedDays}일의 기록을 JSON 파일로 다운로드`}
                  </small>
                </span>
                <ArrowDownToLine size={17} />
              </button>
              <button
                className="data-action"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={21} />
                <span>
                  <strong>백업 파일 불러오기</strong>
                  <small>daily.에서 내보낸 JSON 파일 · 최대 10MB</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                aria-label="백업 파일 선택"
                className="sr-only"
                onChange={(event) => void importFile(event.target.files?.[0])}
              />
              {pendingImport && (
                <div className="import-confirm">
                  <strong>
                    {
                      Object.values(pendingImport.days).filter(hasContent)
                        .length
                    }
                    일의 기록을 불러올까요?
                  </strong>
                  <p>
                    현재 기록 전체가 백업 파일의 내용으로 바뀝니다. 먼저 현재
                    기록을 백업하는 것을 권장해요.
                  </p>
                  <div>
                    <button
                      className="secondary-button"
                      onClick={() => setPendingImport(null)}
                    >
                      취소
                    </button>
                    <button className="primary-button" onClick={confirmImport}>
                      현재 기록을 바꾸고 불러오기
                    </button>
                  </div>
                </div>
              )}
              {importError && (
                <p className="import-error" role="alert">
                  {importError}
                </p>
              )}
              <div className="privacy-note">
                <CloudOff size={18} />
                <p>
                  브라우저 데이터 삭제나 시크릿 모드 종료 시 기록이 사라질 수
                  있어요. 백업 파일에는 작성한 내용이 그대로 담기니 안전한 곳에
                  보관해주세요.
                </p>
              </div>
            </>
          )}
        </div>
      </dialog>
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        {toast && (
          <>
            <Check size={15} />
            {toast}
          </>
        )}
      </div>
    </div>
  );
}

function Review({
  journal,
  dates,
  onOpenDay,
}: {
  journal: Journal;
  dates: string[];
  onOpenDay: (key: string) => void;
}) {
  const days = dates.map((key) => journal.days[key] ?? emptyDay());
  const totalTasks = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const doneTasks = days.reduce(
    (sum, day) => sum + day.tasks.filter((task) => task.done).length,
    0,
  );
  const entries = days.reduce((sum, day) => sum + day.entries.length, 0);
  const recorded = days.filter(hasContent).length;
  const rated = days.filter((day) => day.rating !== null);
  const average = rated.length
    ? (rated.reduce((sum, day) => sum + day.rating!, 0) / rated.length).toFixed(
        1,
      )
    : "—";
  const maxCount = Math.max(3, ...days.map((day) => day.entries.length));
  return (
    <div className="review-page">
      <div className="day-heading">
        <h2>
          이번 주 통계{" "}
          <span>
            {monthDay(dates[0])} – {monthDay(dates[6])}
          </span>
        </h2>
      </div>
      <div className="review-stats">
        <div>
          <span>기록한 날</span>
          <strong>
            {recorded}
            <small> / 7일</small>
          </strong>
        </div>
        <div>
          <span>완료한 할 일</span>
          <strong>
            {doneTasks}
            <small> / {totalTasks}개</small>
          </strong>
        </div>
        <div>
          <span>기록 수</span>
          <strong>
            {entries}
            <small> 개</small>
          </strong>
        </div>
        <div>
          <span>평균 하루 평가</span>
          <strong>
            {average}
            <small> / 5</small>
          </strong>
        </div>
      </div>
      <div className="review-grid">
        <section className="card">
          <div className="card-heading">
            <div>
              <span className="section-icon">
                <ChartNoAxesCombined size={19} />
              </span>
              <h3>날짜별 기록 수</h3>
            </div>
            <span className="subtle-label">기록 수 · 클릭해서 보기</span>
          </div>
          <div className="chart" aria-label="요일별 하루 기록 수">
            {dates.map((key, i) => (
              <button
                key={key}
                className="chart-column"
                onClick={() => onOpenDay(key)}
                aria-label={`${monthDay(key)} 기록 ${days[i].entries.length}개 보기`}
              >
                <span className="chart-number">{days[i].entries.length}</span>
                <span className="chart-bar-track">
                  <span
                    className="chart-bar"
                    style={{
                      height: `${Math.max(4, (days[i].entries.length / maxCount) * 100)}%`,
                    }}
                  />
                </span>
                <span>{weekdays[i]}</span>
                <small>{fromKey(key).getDate()}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="card weekly-records">
        <div className="card-heading">
          <div>
            <span className="section-icon">
              <BookOpen size={18} />
            </span>
            <h3>주간 기록</h3>
          </div>
          <span className="subtle-label">
            각 날짜를 눌러 자세히 볼 수 있어요
          </span>
        </div>
        {dates.map((key, i) => (
          <button
            key={key}
            className="weekly-row"
            onClick={() => onOpenDay(key)}
          >
            <div className="weekly-date">
              <strong>{fromKey(key).getDate()}</strong>
              <span>{weekdays[i]}</span>
            </div>
            <div className="weekly-copy">
              <strong>
                {days[i].reflection.trim() ||
                  days[i].entries.at(-1)?.text ||
                  (hasContent(days[i]) ? "기록 있음" : "기록 없음")}
              </strong>
              <span>
                {hasContent(days[i])
                  ? `할 일 ${days[i].tasks.filter((task) => task.done).length}/${days[i].tasks.length}개 완료 · 기록 ${days[i].entries.length}개`
                  : "기록 없음"}
              </span>
            </div>
            <span className="weekly-mood">
              {days[i].rating ? `${days[i].rating}/5` : "—"}
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
      </section>
    </div>
  );
}
