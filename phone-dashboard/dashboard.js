// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: tachometer-alt;

// ---------------------------------------------------------------------------
// DASHBOARD
//
// Doua moduri, acelasi fisier:
//   * rulat ca WIDGET  -> card compact pe home screen (refresh la ~15-30 min,
//                         limita impusa de iOS, nu de script)
//   * rulat ca APP     -> dashboard full-screen, live, care bate din secunda
//                         in secunda (ceas, countdown, vreme)
//
// Setup: vezi README.md
// ---------------------------------------------------------------------------

const CONFIG = {
  // Culoarea de accent (portocaliul de pe lock screen-ul tau)
  accent: "#FF4A17",
  locale: "ro-RO",

  // Ziua ca succesiune de INTERVALE, nu de momente. Ultimul se inchide peste
  // miezul noptii in primul. kind: "free" | "work" | "break" | "off"
  segments: [
    { from: "06:30", to: "15:05", label: "TIMP LIBER", kind: "free"  },
    { from: "15:05", to: "20:25", label: "TURA I",     kind: "work"  },
    { from: "20:25", to: "21:00", label: "PAUZA",      kind: "break" },
    { from: "21:00", to: "23:25", label: "TURA II",    kind: "work"  },
    { from: "23:25", to: "06:30", label: "ODIHNA",     kind: "off"   },
  ],

  // Lasa gol [] ca sa iei tot din Reminders, sau pune numele listelor:
  // reminderLists: ["ROUTINE I", "Inbox"],
  reminderLists: [],
  maxReminders: 8,

  // null, null => foloseste GPS-ul. Pune coordonate fixe daca vrei sa eviti
  // promptul de locatie (si sa mearga widget-ul in fundal).
  weather: { lat: null, lon: null },

  // La cat timp cere widget-ul sa fie reimprospatat (iOS poate ignora)
  refreshMinutes: 15,
};

// --- helpers ---------------------------------------------------------------

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Cea mai apropiata ocurenta a lui HH:MM strict dupa `now`.
function nextAt(now, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

// Cea mai recenta ocurenta a lui HH:MM la sau inainte de `now`.
function prevAt(now, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d > now) d.setDate(d.getDate() - 1);
  return d;
}

// In ce interval suntem acum, cand se termina si ce urmeaza.
// Countdown-ul tinteste mereu sfarsitul intervalului curent, care e totodata
// inceputul celui urmator: in tura tinteste pauza, in pauza tinteste tura II.
function routineState(now) {
  const segs = CONFIG.segments;
  if (!segs || !segs.length) return null;

  const cur = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  let i = segs.findIndex((sg) => {
    const f = toMinutes(sg.from);
    const t = toMinutes(sg.to);
    // Intervalul care trece peste miezul noptii (from > to) e "sau/sau".
    return f <= t ? cur >= f && cur < t : cur >= f || cur < t;
  });
  if (i === -1) i = 0; // gauri in configuratie: cadem pe primul interval

  const seg = segs[i];
  const nxt = segs[(i + 1) % segs.length];

  // Fiind in interval, sfarsitul lui e mereu in viitor si inceputul in trecut,
  // asa ca ocurentele apropiate sunt automat corecte si peste miezul noptii.
  return {
    current: seg.label,
    kind: seg.kind,
    startAt: prevAt(now, seg.from).getTime(),
    next: nxt.label,
    nextKind: nxt.kind,
    nextTime: seg.to,
    nextAt: nextAt(now, seg.to).getTime(),
  };
}

async function getReminders() {
  try {
    let all = await Reminder.allIncomplete();
    if (CONFIG.reminderLists.length) {
      all = all.filter((r) => r.calendar && CONFIG.reminderLists.includes(r.calendar.title));
    }
    all.sort((a, b) => {
      const ad = a.dueDate ? a.dueDate.getTime() : Infinity;
      const bd = b.dueDate ? b.dueDate.getTime() : Infinity;
      return ad - bd;
    });
    return {
      total: all.length,
      items: all.slice(0, CONFIG.maxReminders).map((r) => ({
        title: r.title,
        list: r.calendar ? r.calendar.title : "",
        due: r.dueDate ? r.dueDate.getTime() : null,
        overdue: !!(r.dueDate && r.dueDate.getTime() < Date.now()),
      })),
    };
  } catch (e) {
    return { total: 0, items: [], error: String(e) };
  }
}

async function getEvents() {
  try {
    const evs = await CalendarEvent.today([]);
    return evs
      .filter((e) => e.isAllDay || e.endDate.getTime() >= Date.now())
      .slice(0, 5)
      .map((e) => ({
        title: e.title,
        allDay: e.isAllDay,
        start: e.startDate.getTime(),
        end: e.endDate.getTime(),
        location: e.location || "",
      }));
  } catch (e) {
    return [];
  }
}

const WEATHER_CODES = {
  0: ["Senin", "☀️"],
  1: ["Senin", "🌤"],
  2: ["Noros part.", "⛅"],
  3: ["Innorat", "☁️"],
  45: ["Ceata", "🌫"],
  48: ["Chiciura", "🌫"],
  51: ["Burnita us.", "🌦"],
  53: ["Burnita", "🌦"],
  55: ["Burnita++", "🌦"],
  61: ["Ploaie us.", "🌧"],
  63: ["Ploaie", "🌧"],
  65: ["Ploaie++", "🌧"],
  71: ["Ninsoare u.", "🌨"],
  73: ["Ninsoare", "🌨"],
  75: ["Ninsoare++", "❄️"],
  80: ["Averse", "🌦"],
  81: ["Averse", "🌧"],
  82: ["Averse++", "⛈"],
  95: ["Furtuna", "⛈"],
  96: ["Grindina", "⛈"],
  99: ["Grindina", "⛈"],
};

async function getWeather() {
  try {
    let { lat, lon } = CONFIG.weather;
    if (lat == null || lon == null) {
      Location.setAccuracyToHundredMeters();
      const loc = await Location.current();
      lat = loc.latitude;
      lon = loc.longitude;
    }
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
      "&longitude=" + lon +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
      "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&timezone=auto&forecast_days=1";
    const data = await new Request(url).loadJSON();
    const code = data.current.weather_code;
    const info = WEATHER_CODES[code] || ["-", "🌡"];
    return {
      temp: Math.round(data.current.temperature_2m),
      feels: Math.round(data.current.apparent_temperature),
      wind: Math.round(data.current.wind_speed_10m),
      label: info[0],
      icon: info[1],
      min: Math.round(data.daily.temperature_2m_min[0]),
      max: Math.round(data.daily.temperature_2m_max[0]),
      sunrise: data.daily.sunrise[0].slice(11, 16),
      sunset: data.daily.sunset[0].slice(11, 16),
      lat: lat,
      lon: lon,
    };
  } catch (e) {
    return null;
  }
}

async function collect() {
  const now = new Date();
  const [reminders, events, weather] = await Promise.all([
    getReminders(),
    getEvents(),
    getWeather(),
  ]);
  return {
    now: now.getTime(),
    routine: routineState(now),
    reminders: reminders,
    events: events,
    weather: weather,
    battery: Math.round(Device.batteryLevel() * 100),
    charging: Device.isCharging(),
    accent: CONFIG.accent,
    locale: CONFIG.locale,
  };
}

// --- WIDGET ----------------------------------------------------------------


function buildWidget(data) {
  const accent = new Color(CONFIG.accent);
  const dim = new Color("#8A8A8E");
  const w = new ListWidget();
  w.backgroundColor = new Color("#000000");
  w.setPadding(14, 16, 14, 16);
  w.refreshAfterDate = new Date(Date.now() + CONFIG.refreshMinutes * 60 * 1000);

  const family = config.widgetFamily || "medium";

  // Header: pasul urmator din rutina
  if (data.routine) {
    const head = w.addStack();
    head.centerAlignContent();
    const tag = head.addText("ACUM \u00B7 " + data.routine.current);
    tag.font = Font.semiboldSystemFont(10);
    tag.textColor = dim;
    head.addSpacer();
    const at = head.addText(data.routine.nextTime);
    at.font = Font.semiboldRoundedSystemFont(12);
    at.textColor = accent;
    w.addSpacer(4);

    const label = w.addText(data.routine.next);
    label.font = Font.boldSystemFont(family === "small" ? 15 : 19);
    label.textColor = Color.white();
    label.lineLimit = 1;

    // Countdown care curge singur, fara refresh: WidgetKit anima acest text.
    const cdRow = w.addStack();
    cdRow.centerAlignContent();
    const cdSize = family === "small" ? 12 : 14;
    const cdPre = cdRow.addText("in");
    cdPre.font = Font.mediumRoundedSystemFont(cdSize);
    cdPre.textColor = accent;
    cdRow.addSpacer(5);
    const cd = cdRow.addDate(new Date(data.routine.nextAt));
    cd.applyTimerStyle();
    cd.font = Font.mediumRoundedSystemFont(cdSize);
    cd.textColor = accent;
    cdRow.addSpacer();

    // Cere un refresh fix la ora pasului urmator, ca widget-ul sa treaca la
    // pasul urmator exact atunci, nu la urmatorul ciclu de refresh.
    const flip = new Date(data.routine.nextAt + 5000);
    if (flip < w.refreshAfterDate) w.refreshAfterDate = flip;
  }

  if (family !== "small" && data.reminders.items.length) {
    w.addSpacer(8);
    const line = w.addStack();
    line.addSpacer();
    line.size = new Size(0, 1);
    line.backgroundColor = new Color("#2C2C2E");
    w.addSpacer(8);

    const count = family === "large" ? 8 : 3;
    for (const r of data.reminders.items.slice(0, count)) {
      const row = w.addStack();
      row.centerAlignContent();
      const dot = row.addText("○");
      dot.font = Font.systemFont(11);
      dot.textColor = r.overdue ? accent : dim;
      row.addSpacer(6);
      const t = row.addText(r.title);
      t.font = Font.systemFont(12);
      t.textColor = new Color("#E5E5EA");
      t.lineLimit = 1;
      w.addSpacer(4);
    }
  }

  w.addSpacer();

  // Footer: vreme + baterie + total reminders
  const foot = w.addStack();
  foot.centerAlignContent();
  if (data.weather) {
    const wx = foot.addText(data.weather.icon + " " + data.weather.temp + "°");
    wx.font = Font.mediumSystemFont(12);
    wx.textColor = new Color("#E5E5EA");
  }
  foot.addSpacer();
  const meta = foot.addText(
    (family === "small" ? "" : data.reminders.total + " task   ") +
    (data.charging ? "⚡ " : "") + data.battery + "%"
  );
  meta.font = Font.systemFont(11);
  meta.textColor = dim;

  return w;
}

// --- DASHBOARD FULL-SCREEN -------------------------------------------------

function buildHTML(data) {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>Dashboard</title>
<style>
  :root {
    --accent: ${CONFIG.accent};
    --bg: #000;
    --card: #131315;
    --line: #262629;
    --fg: #fff;
    --dim: #8A8A8E;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-user-select: none; }
  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, "SF Pro Display", system-ui, sans-serif;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  body {
    padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 16px 18px;
    min-height: 0;
    overflow: hidden;
  }
  .lbl {
    font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--dim); font-weight: 600;
  }
  #clock {
    font-size: clamp(56px, 17vw, 132px);
    font-weight: 700; line-height: .92;
    font-variant-numeric: tabular-nums;
    letter-spacing: -.03em;
  }
  #clock .sec { font-size: .32em; color: var(--accent); vertical-align: super; margin-left: .06em; }
  #date { color: var(--dim); font-size: 15px; margin-top: 6px; text-transform: capitalize; }
  .next-label { font-size: clamp(22px, 6vw, 40px); font-weight: 700; line-height: 1.05; margin-top: 4px; }
  .next-cd { color: var(--accent); font-size: clamp(16px, 4.5vw, 26px); font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .bar { height: 5px; background: #232326; border-radius: 3px; margin-top: 14px; overflow: hidden; }
  .bar > i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 3px; transition: width .4s linear; }
  .bar-ends { display: flex; justify-content: space-between; font-size: 11px; color: var(--dim); margin-top: 6px; font-variant-numeric: tabular-nums; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: start; }
  .stat { text-align: left; }
  .stat b { display: block; font-size: clamp(18px, 5vw, 28px); font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat b, .stat span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stat span { display: block; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
  .lists { display: grid; gap: 12px; grid-template-columns: 1fr; min-height: 0; }
  .scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
  ul { list-style: none; margin-top: 10px; }
  li { display: flex; gap: 10px; align-items: baseline; padding: 7px 0; border-top: 1px solid var(--line); font-size: 14px; }
  li:first-child { border-top: 0; }
  li .o { color: var(--dim); font-size: 12px; }
  li.over .o, li.over time { color: var(--accent); }
  li p { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li time { font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .empty { color: var(--dim); font-size: 13px; margin-top: 10px; }
  @media (orientation: landscape) {
    body { grid-template-columns: 1.05fr 1fr; grid-template-rows: auto 1fr; }
    #hero { grid-row: span 2; display: flex; flex-direction: column; justify-content: center; }
    .lists { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<section class="card" id="hero">
  <div id="clock">--:--<span class="sec">--</span></div>
  <div id="date"></div>
  <div style="margin-top:22px">
    <div class="lbl">Urmeaza</div>
    <div class="next-label" id="nextLabel">-</div>
    <div class="next-cd" id="nextCd">-</div>
    <div class="bar"><i id="barFill"></i></div>
    <div class="bar-ends"><span id="barA">-</span><span id="barB">-</span></div>
  </div>
</section>

<section class="card stats">
  <div class="stat"><b id="sTemp">-</b><span id="sTempL">Vreme</span></div>
  <div class="stat"><b id="sTask">-</b><span>Task-uri</span></div>
  <div class="stat"><b id="sBat">-</b><span>Baterie</span></div>
  <div class="stat"><b id="sSun">-</b><span>Apus</span></div>
</section>

<section class="lists">
  <div class="card scroll">
    <div class="lbl">De facut</div>
    <ul id="rem"></ul>
  </div>
</section>

<script>
var DATA = ${JSON.stringify(data)};
var LOCALE = DATA.locale || "ro-RO";
var OFFSET = DATA.now - Date.now(); // aliniem ceasul paginii cu cel al scriptului

function pad(n) { return String(n).padStart(2, "0"); }
function now() { return new Date(Date.now() + OFFSET); }

function fmtCd(ms) {
  if (ms < 0) ms = 0;
  var t = Math.floor(ms / 1000);
  var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h > 0 ? h + ":" + pad(m) : m) + ":" + pad(s);
}

function tick() {
  var d = now();
  document.getElementById("clock").innerHTML =
    pad(d.getHours()) + ":" + pad(d.getMinutes()) +
    '<span class="sec">' + pad(d.getSeconds()) + "</span>";
  document.getElementById("date").textContent =
    d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });

  var r = DATA.routine;
  if (r) {
    var target = r.nextAt, prev = r.startAt;
    // daca am depasit tinta, mutam fereastra inainte cu 24h (pagina poate sta ore intregi)
    while (d.getTime() > target) { target += 86400000; prev += 86400000; }
    document.getElementById("nextLabel").textContent = r.next;
    document.getElementById("nextCd").textContent = "in " + fmtCd(target - d.getTime());
    document.getElementById("barA").textContent = r.current;
    document.getElementById("barB").textContent = r.nextTime;
    var span = target - prev;
    var pct = span > 0 ? ((d.getTime() - prev) / span) * 100 : 0;
    document.getElementById("barFill").style.width = Math.max(0, Math.min(100, pct)) + "%";
  } else {
    document.getElementById("nextLabel").textContent = "Nicio rutina definita";
    document.getElementById("nextCd").textContent = "";
  }
}

function renderStatic() {
  document.getElementById("sTask").textContent = DATA.reminders.total;
  document.getElementById("sBat").textContent = DATA.battery + "%" + (DATA.charging ? " \\u26A1" : "");

  var ul = document.getElementById("rem");
  ul.innerHTML = "";
  var items = DATA.reminders.items.concat(
    DATA.events.map(function (e) {
      return {
        title: e.title,
        due: e.allDay ? null : e.start,
        overdue: false,
        event: true
      };
    })
  );
  if (!items.length) {
    ul.innerHTML = '<li style="border:0"><p class="empty">Nimic in asteptare.</p></li>';
    return;
  }
  items.forEach(function (it) {
    var li = document.createElement("li");
    if (it.overdue) li.className = "over";
    var o = document.createElement("span");
    o.className = "o";
    o.textContent = it.event ? "\\u25C7" : "\\u25CB";
    var p = document.createElement("p");
    p.textContent = it.title;
    li.appendChild(o);
    li.appendChild(p);
    if (it.due) {
      var t = document.createElement("time");
      var dd = new Date(it.due);
      t.textContent = pad(dd.getHours()) + ":" + pad(dd.getMinutes());
      li.appendChild(t);
    }
    ul.appendChild(li);
  });
}

function renderWeather(w) {
  if (!w) {
    document.getElementById("sTemp").textContent = "-";
    return;
  }
  document.getElementById("sTemp").textContent = w.temp + "\\u00B0";
  document.getElementById("sTempL").textContent = w.label;
  document.getElementById("sSun").textContent = w.sunset;
}

// Vremea se reimprospateaza singura din pagina, la 10 minute.
function refreshWeather() {
  var w = DATA.weather;
  if (!w || w.lat == null) return;
  var url = "https://api.open-meteo.com/v1/forecast?latitude=" + w.lat +
    "&longitude=" + w.lon +
    "&current=temperature_2m,weather_code&daily=sunset&timezone=auto&forecast_days=1";
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (j) {
      w.temp = Math.round(j.current.temperature_2m);
      w.sunset = j.daily.sunset[0].slice(11, 16);
      renderWeather(w);
    })
    .catch(function () {});
}

renderStatic();
renderWeather(DATA.weather);
tick();
setInterval(tick, 250);
setInterval(refreshWeather, 10 * 60 * 1000);

// Incearca sa tina ecranul aprins (nu merge peste tot; vezi README pentru Auto-Lock)
if (navigator.wakeLock) {
  navigator.wakeLock.request("screen").catch(function () {});
}
</script>
</body>
</html>`;
}

// --- entry point -----------------------------------------------------------

const data = await collect();

if (config.runsInWidget) {
  Script.setWidget(buildWidget(data));
} else {
  const wv = new WebView();
  await wv.loadHTML(buildHTML(data), null, null, true);
  await wv.present(true);
}
Script.complete();
