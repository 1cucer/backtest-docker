// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: circle-notch;

// ---------------------------------------------------------------------------
// FOCUS
//
// One widget. Its content changes with the part of the day you are in, so it
// only ever shows what you can act on right now.
//
//   on shift   -> time to break, progress, hours worked, earnings so far
//   on break   -> time until you are back
//   off shift  -> time until shift starts, and what you can still get done
//   resting    -> time until you are up, and nothing else
//
// Supports home screen (small / medium / large) and lock screen
// (accessoryRectangular / accessoryCircular / accessoryInline).
// ---------------------------------------------------------------------------

const CONFIG = {
  accent: "#FF4A17",

  // Your day as intervals. The last one closes over midnight into the first.
  // kind: "free" | "work" | "break" | "off"
  segments: [
    { from: "06:30", to: "15:05", label: "OFF SHIFT", kind: "free"  },
    { from: "15:05", to: "20:25", label: "SHIFT I",   kind: "work"  },
    { from: "20:25", to: "21:00", label: "BREAK",     kind: "break" },
    { from: "21:00", to: "23:25", label: "SHIFT II",  kind: "work"  },
    { from: "23:25", to: "06:30", label: "REST",      kind: "off"   },
  ],

  // Live earnings. Set your gross hourly pay to switch it on, null to hide.
  hourlyRate: null,
  currency: "€",

  // Reminder lists to surface while you are off shift. [] means every list.
  taskLists: [],

  // Tapping the widget runs this Scriptable script. null to just open Scriptable.
  tapOpensScript: "Dashboard",
};

// --- design tokens ---------------------------------------------------------

const C = {
  bg: "#000000",
  fg: "#FFFFFF",
  muted: "#6E6E73",
  track: "#1C1C1E",
  hairline: "#48484A",
  accent: CONFIG.accent,
};

// One type scale, four steps. Nothing else is allowed on the widget.
const TYPE = { micro: 10, small: 12, hero: 46, heroSmall: 30, heroLock: 22 };

// One spacing rhythm, all multiples of four.
const SP = { xs: 4, sm: 8, md: 12, lg: 18 };

// Widget point widths per screen width. Only the progress bar needs this, so a
// few points either way is invisible.
const WIDTHS = {
  430: { small: 170, medium: 364 },
  428: { small: 170, medium: 364 },
  414: { small: 169, medium: 360 },
  402: { small: 162, medium: 344 },
  393: { small: 158, medium: 338 },
  390: { small: 158, medium: 338 },
  375: { small: 155, medium: 329 },
  360: { small: 155, medium: 329 },
  320: { small: 141, medium: 291 },
};

function widgetWidth(family) {
  const sw = Math.round(Device.screenSize().width);
  const row = WIDTHS[sw];
  const key = family === "small" ? "small" : "medium";
  if (row) return row[key];
  return key === "small" ? Math.round(sw * 0.4) : Math.round(sw * 0.86);
}

// --- time ------------------------------------------------------------------

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nextOccurrence(now, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

function prevOccurrence(now, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d > now) d.setDate(d.getDate() - 1);
  return d;
}

// Which interval are we in, when does it end, and what comes after.
function dayState(now) {
  const segs = CONFIG.segments;
  if (!segs || !segs.length) return null;
  const cur = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  let i = segs.findIndex((s) => {
    const f = toMinutes(s.from);
    const t = toMinutes(s.to);
    // An interval that crosses midnight (from > to) matches either side.
    return f <= t ? cur >= f && cur < t : cur >= f || cur < t;
  });
  if (i === -1) i = 0;

  const seg = segs[i];
  const nxt = segs[(i + 1) % segs.length];
  const startAt = prevOccurrence(now, seg.from);
  const endAt = nextOccurrence(now, seg.to);

  return {
    seg: seg,
    next: nxt,
    startAt: startAt.getTime(),
    endAt: endAt.getTime(),
    progress: Math.min(1, Math.max(0,
      (now.getTime() - startAt.getTime()) / (endAt.getTime() - startAt.getTime()))),
  };
}

// Minutes spent inside "work" intervals so far today.
function workedMinutes(now) {
  const cur = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  let total = 0;
  for (const s of CONFIG.segments) {
    if (s.kind !== "work") continue;
    const f = toMinutes(s.from);
    const t = toMinutes(s.to);
    if (f > t) continue; // a work interval across midnight is not counted
    if (cur >= t) total += t - f;
    else if (cur > f) total += cur - f;
  }
  return total;
}

function hm(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m";
}

// --- data ------------------------------------------------------------------

async function openTasks() {
  try {
    let all = await Reminder.allIncomplete();
    if (CONFIG.taskLists.length) {
      all = all.filter((r) => r.calendar && CONFIG.taskLists.includes(r.calendar.title));
    }
    all.sort((a, b) => (a.dueDate ? a.dueDate.getTime() : Infinity) -
                       (b.dueDate ? b.dueDate.getTime() : Infinity));
    return { count: all.length, first: all.length ? all[0].title : null };
  } catch (e) {
    return { count: 0, first: null };
  }
}

// What the widget says, per kind of interval. One place, so the rules are
// readable rather than scattered through the layout code.
function script(state, tasks, now) {
  const { seg, next, endAt } = state;
  const rail = [];

  if (seg.kind === "work") {
    if (CONFIG.hourlyRate) {
      const earned = (workedMinutes(now) / 60) * CONFIG.hourlyRate;
      rail.push(CONFIG.currency + earned.toFixed(2));
    }
    rail.push(hm(workedMinutes(now)) + " worked");
    rail.push(Math.round(state.progress * 100) + "%");
  } else if (seg.kind === "break") {
    rail.push(hm((endAt - now.getTime()) / 60000) + " left");
    rail.push("then " + next.label);
  } else if (seg.kind === "free") {
    if (tasks.first) rail.push(tasks.first);
    else rail.push("nothing open");
    if (tasks.count) rail.push(tasks.count + " open");
  }
  // "off" gets an empty rail on purpose: nothing is actionable at 3am.

  return {
    eyebrow: seg.label,
    target: next.label + " " + seg.to,
    rail: rail,
  };
}

// --- layout ----------------------------------------------------------------

function text(parent, str, size, weight, color) {
  const t = parent.addText(str);
  t.font = weight === "bold" ? Font.boldSystemFont(size)
         : weight === "semibold" ? Font.semiboldSystemFont(size)
         : Font.systemFont(size);
  t.textColor = new Color(color);
  t.lineLimit = 1;
  return t;
}

// A hairline progress bar built from two rounded stacks.
function bar(parent, width, pct, height) {
  const h = height || 3;
  const track = parent.addStack();
  track.size = new Size(width, h);
  track.cornerRadius = h / 2;
  track.backgroundColor = new Color(C.track);

  const fillW = Math.max(h, Math.round(width * Math.min(1, Math.max(0, pct))));
  const fill = track.addStack();
  fill.size = new Size(fillW, h);
  fill.cornerRadius = h / 2;
  fill.backgroundColor = new Color(C.accent);
  track.addSpacer();
}

function buildHome(state, copy, family) {
  const w = new ListWidget();
  w.backgroundColor = new Color(C.bg);
  const pad = family === "small" ? SP.lg - 2 : SP.lg;
  w.setPadding(pad, pad, pad, pad);
  if (CONFIG.tapOpensScript) w.url = "scriptable:///run/" + encodeURIComponent(CONFIG.tapOpensScript);

  // The widget flips to the next interval the moment this one ends.
  w.refreshAfterDate = new Date(state.endAt + 2000);

  const width = widgetWidth(family) - pad * 2;

  // 1 — eyebrow: where you are, and where you are headed
  const head = w.addStack();
  head.centerAlignContent();
  text(head, copy.eyebrow.toUpperCase(), TYPE.micro, "semibold", C.muted);
  head.addSpacer();
  if (family !== "small") text(head, copy.target, TYPE.micro, "semibold", C.accent);

  w.addSpacer();

  // 2 — hero: the one number worth a glance, ticking without a refresh
  const hero = w.addStack();
  hero.centerAlignContent();
  const d = hero.addDate(new Date(state.endAt));
  d.applyTimerStyle();
  d.font = Font.mediumRoundedSystemFont(family === "small" ? TYPE.heroSmall : TYPE.hero);
  d.textColor = new Color(C.fg);
  if (family !== "small") {
    hero.addSpacer(SP.sm);
    // Without this, a sub-hour countdown like "20:00" reads as a clock time.
    text(hero, "left", TYPE.small, "regular", C.muted);
  }
  hero.addSpacer();

  w.addSpacer(family === "small" ? SP.sm : SP.md);

  // 3 — progress through the current interval
  bar(w, width, state.progress);

  // 4 — rail: at most three supporting facts, never more
  if (copy.rail.length && family !== "small") {
    w.addSpacer(SP.md);
    const rail = w.addStack();
    rail.centerAlignContent();
    copy.rail.slice(0, 3).forEach((item, i) => {
      if (i) {
        rail.addSpacer(SP.sm);
        text(rail, "·", TYPE.small, "regular", C.hairline);
        rail.addSpacer(SP.sm);
      }
      text(rail, item, TYPE.small, i === 0 ? "semibold" : "regular",
           i === 0 ? C.fg : C.muted);
    });
    rail.addSpacer();
  }

  w.addSpacer();
  return w;
}

function buildLock(state, copy, family) {
  const w = new ListWidget();
  w.addAccessoryWidgetBackground = family === "accessoryCircular";
  if (CONFIG.tapOpensScript) w.url = "scriptable:///run/" + encodeURIComponent(CONFIG.tapOpensScript);
  w.refreshAfterDate = new Date(state.endAt + 2000);

  if (family === "accessoryInline") {
    // A single line, drawn by the system next to the date.
    const d = w.addDate(new Date(state.endAt));
    d.applyTimerStyle();
    return w;
  }

  if (family === "accessoryCircular") {
    w.setPadding(0, 0, 0, 0);
    const s = w.addStack();
    s.centerAlignContent();
    s.addSpacer();
    text(s, Math.round(state.progress * 100) + "%", 16, "bold", C.fg);
    s.addSpacer();
    return w;
  }

  // accessoryRectangular
  w.setPadding(0, 0, 0, 0);
  text(w, copy.eyebrow.toUpperCase(), TYPE.micro, "semibold", C.fg);
  const d = w.addDate(new Date(state.endAt));
  d.applyTimerStyle();
  d.font = Font.mediumRoundedSystemFont(TYPE.heroLock);
  d.textColor = new Color(C.fg);
  w.addSpacer(SP.xs);
  bar(w, 130, state.progress, 2);
  return w;
}

// --- entry point -----------------------------------------------------------

const now = new Date();
const state = dayState(now);
const family = config.widgetFamily || "medium";
const tasks = state.seg.kind === "free" ? await openTasks() : { count: 0, first: null };
const copy = script(state, tasks, now);

const widget = family.startsWith("accessory")
  ? buildLock(state, copy, family)
  : buildHome(state, copy, family);

if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
