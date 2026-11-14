"use client";
import { Fragment } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Video,
} from "lucide-react";
import {
  dayKey,
  eventOnDay,
  graphDate,
  isoWeek,
  monthDays,
  teamsJoinUrl,
} from "@/lib/mail/calendar";
import type { MailPimItem } from "./MailPim";
import c from "./calendar.module.css";
export function MailCalendarMonth({
  month,
  selected,
  items,
  busy,
  onMonth,
  onSelect,
  onNew,
  onEdit,
  onRemove,
}: {
  month: Date;
  selected: Date;
  items: MailPimItem[];
  busy: boolean;
  onMonth: (date: Date) => void;
  onSelect: (date: Date) => void;
  onNew: () => void;
  onEdit: (item: MailPimItem) => void;
  onRemove: (item: MailPimItem) => void;
}) {
  const days = monthDays(month),
    today = dayKey(new Date());
  const sorted = [...items].sort(
    (a, b) =>
      graphDate(a.start?.dateTime || "").getTime() -
      graphDate(b.start?.dateTime || "").getTime(),
  );
  const agenda = sorted.filter((item) => eventOnDay(item, selected));
  function move(amount: number) {
    onMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }
  return (
    <section
      className={c.calendar}
      aria-label="Monatskalender"
      aria-busy={busy}
    >
      <header className={c.header}>
        <h1>
          <CalendarDays size={25} />
          {month.toLocaleDateString("de-DE", {
            month: "long",
            year: "numeric",
          })}
        </h1>
        <div className={c.navigation}>
          <button
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              onSelect(now);
            }}
          >
            Heute
          </button>
          <button
            type="button"
            aria-label="Nächster Monat"
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
          <button
            type="button"
            aria-label="Neuen Termin erstellen"
            title="Neuer Termin"
            disabled={busy}
            onClick={onNew}
          >
            <Plus size={20} />
          </button>
        </div>
      </header>
      <div
        className={c.grid}
        style={{
          gridTemplateRows: `34px repeat(${days.length / 7}, minmax(76px, 1fr))`,
          minHeight: 34 + (days.length / 7) * 76,
        }}
      >
        <span className={c.weekHeading} title="Kalenderwoche">
          KW
        </span>
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <span className={c.weekday} key={d}>
            {d}
          </span>
        ))}
        {days.map((day, index) => {
          const outside = day.getMonth() !== month.getMonth();
          const entries = outside
            ? []
            : sorted.filter((item) => eventOnDay(item, day));
          const key = dayKey(day),
            isToday = key === today,
            isSelected = key === dayKey(selected);
          return (
            <Fragment key={key}>
              {index % 7 === 0 ? (
                <span
                  className={c.weekNumber}
                  aria-label={`Kalenderwoche ${isoWeek(day)}`}
                >
                  {isoWeek(day)}
                </span>
              ) : null}
              <div
                className={[
                  c.day,
                  outside ? c.outside : "",
                  isToday ? c.today : "",
                  isSelected ? c.selected : "",
                ].join(" ")}
              >
                {!outside ? (
                  <>
                    <button
                      type="button"
                      className={c.dayNumber}
                      aria-label={day.toLocaleDateString("de-DE", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      aria-current={isToday ? "date" : undefined}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(day)}
                    >
                      {day.getDate()}
                    </button>
                    {entries.slice(0, 2).map((item) => (
                      <button
                        type="button"
                        className={c.chip}
                        key={item.id}
                        title={item.subject}
                        aria-label={`${item.subject}, ${day.toLocaleDateString("de-DE")}`}
                        onClick={() => {
                          onSelect(day);
                          document
                            .getElementById("calendar-day-agenda")
                            ?.scrollIntoView({
                              block: "nearest",
                              behavior: "smooth",
                            });
                        }}
                      >
                        {item.isOnlineMeeting ? "▣ " : ""}
                        {item.subject}
                      </button>
                    ))}
                    {entries.length > 2 ? (
                      <button
                        type="button"
                        className={c.more}
                        onClick={() => onSelect(day)}
                      >
                        +{entries.length - 2}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
      <section
        className={c.agenda}
        id="calendar-day-agenda"
        aria-label="Termine am ausgewählten Tag"
      >
        <header>
          <h2>
            {selected.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <button
            type="button"
            className={c.newEvent}
            disabled={busy}
            onClick={onNew}
          >
            <Plus size={18} />
            Neuer Termin
          </button>
        </header>
        {!agenda.length ? (
          <p>
            {busy ? "Termine werden geladen …" : "Keine Termine an diesem Tag."}
          </p>
        ) : (
          agenda.map((item) => {
            const join = teamsJoinUrl(item.onlineMeeting?.joinUrl);
            return (
              <article className={c.event} key={item.id}>
                <div>
                  <strong>{item.subject}</strong>
                  <small>
                    {item.isAllDay
                      ? "Ganztägig"
                      : `${graphDate(item.start!.dateTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – ${graphDate(item.end!.dateTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                    {item.location?.displayName
                      ? ` · ${item.location.displayName}`
                      : ""}
                  </small>
                </div>
                <div className={c.actions}>
                  {join ? (
                    <a href={join} target="_blank" rel="noopener noreferrer">
                      <Video size={16} />
                      Teams beitreten
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || item.isOrganizer === false}
                    onClick={() => onEdit(item)}
                  >
                    Bearbeiten / Teams
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(item)}
                  >
                    Entfernen
                  </button>
                </div>
                {item.isOrganizer === false ? (
                  <small>
                    Einladung eines anderen Organisators. Den Termin kann nur
                    dieser ändern.
                  </small>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}
