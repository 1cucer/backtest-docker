// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-orange; icon-glyph: image;

// ---------------------------------------------------------------------------
// WALLPAPER
//
// Deseneaza un wallpaper de lock screen cu informatiile zilei si il da mai
// departe catre Shortcuts (actiunea "Set Wallpaper Photo").
//
// Continutul e desenat DOAR in banda dintre ceasul de sistem si butoanele de
// jos, ca sa nu fie acoperit. Vezi CONFIG.band.
//
// E un INSTANTANEU, nu ceva live: de aceea afiseaza ore absolute, niciodata
// countdown-uri care s-ar strica intre doua actualizari.
// ---------------------------------------------------------------------------

const CONFIG = {
  accent: "#FF4A17",
  locale: "ro-RO",

  // Tine-le la fel cu cele din dashboard.js (sunt fisiere separate in
  // Scriptable, nu pot partaja configuratia fara un al treilea script).
  routine: [
    { at: "04:00", label: "WAKE UP" },
    { at: "06:00", label: "PLECARE" },
    { at: "06:45", label: "START TURA" },
    { at: "15:05", label: "PAUZA" },
    { at: "16:00", label: "FINAL TURA" },
    { at: "00:00", label: "SOMN" },
  ],

  reminderLists: [],
  maxReminders: 4,
  weather: { lat: null, lon: null },

  // Banda verticala in care desenam, ca fractie din inaltimea ecranului.
  // top: sub ceas si sub widget-urile de lock screen.
  // bottom: deasupra butoanelor de lanterna/camera.
  band: { top: 0.32, bottom: 0.84 },
};

// --- desen: helpere --------------------------------------------------------

// DrawContext nu poate masura textul, deci estimam latimea unui caracter ca
// fractie din corpul fontului si taiem cu "..." ce nu incape.
const CHAR_W = { bold: 0.58, semibold: 0.55, medium: 0.54, regular: 0.52 };

function fit(str, size, maxW, weight) {
  const per = size * (CHAR_W[weight] || 0.52);
  const max = Math.floor(maxW / per);
  if (str.length <= max) return str;
  return str.slice(0, Math.max(1, max - 1)).trimEnd() + "…";
}

function fontFor(size, weight) {
  if (weight === "bold") return Font.boldSystemFont(size);
  if (weight === "semibold") return Font.semiboldSystemFont(size);
  if (weight === "medium") return Font.mediumSystemFont(size);
  return Font.systemFont(size);
}

function drawText(ctx, str, x, y, size, weight, color, maxW, align) {
  ctx.setFont(fontFor(size, weight));
  ctx.setTextColor(new Color(color));
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(fit(str, size, maxW, weight), new Rect(x, y, maxW, size * 1.35));
}

function roundedRect(ctx, x, y, w, h, r, color) {
  const p = new Path();
  p.addRoundedRect(new Rect(x, y, w, h), r, r);
  ctx.setFillColor(new Color(color));
  ctx.addPath(p);
  ctx.fillPath();
}

function dot(ctx, cx, cy, r, color) {
  ctx.setFillColor(new Color(color));
  ctx.fillEllipse(new Rect(cx - r, cy - r, r * 2, r * 2));
}

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// --- desen: compunerea imaginii -------------------------------------------

function buildWallpaper(data) {
  const sz = Device.screenSize();
  const sc = Device.screenScale();
  const W = Math.round(sz.width * sc);
  const H = Math.round(sz.height * sc);
  const S = W / 1179; // scalare fata de latimea de referinta (iPhone 15 Pro)

  const DIM = "#6E6E73";
  const FG = "#FFFFFF";
  const SOFT = "#C7C7CC";

  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = true;
  ctx.respectScreenScale = false;

  ctx.setFillColor(new Color("#000000"));
  ctx.fillRect(new Rect(0, 0, W, H));

  const M = Math.round(92 * S);
  const CW = W - M * 2;
  const top = Math.round(H * CONFIG.band.top);
  const bottom = Math.round(H * CONFIG.band.bottom);
  let y = top;

  // --- A. pasul urmator ---
  if (data.routine) {
    drawText(ctx, "URMEAZA", M, y, 26 * S, "semibold", DIM, CW * 0.6, "left");
    drawText(ctx, data.routine.nextTime, M + CW * 0.6, y, 30 * S, "semibold",
             CONFIG.accent, CW * 0.4, "right");
    y += Math.round(46 * S);
    drawText(ctx, data.routine.next, M, y, 82 * S, "bold", FG, CW, "left");
    y += Math.round(128 * S);
  }

  // --- B. banda zilei, cu punct pentru fiecare pas si marcaj pentru "acum" ---
  const now = new Date(data.now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const trackH = Math.round(6 * S);
  const trackY = y;

  roundedRect(ctx, M, trackY, CW, trackH, trackH / 2, "#2C2C2E");
  roundedRect(ctx, M, trackY, Math.max(trackH, CW * (nowMin / 1440)), trackH,
              trackH / 2, CONFIG.accent);

  for (const step of CONFIG.routine) {
    const mins = minutesOf(step.at);
    const cx = M + CW * (mins / 1440);
    const past = mins <= nowMin;
    dot(ctx, cx, trackY + trackH / 2, 11 * S, "#000000");
    dot(ctx, cx, trackY + trackH / 2, 8 * S, past ? CONFIG.accent : "#48484A");
  }

  // marcajul "acum"
  const nx = M + CW * (nowMin / 1440);
  roundedRect(ctx, nx - 3 * S, trackY - 13 * S, 6 * S, trackH + 26 * S, 3 * S, FG);

  y += Math.round(34 * S);
  drawText(ctx, "00:00", M, y, 22 * S, "regular", DIM, CW * 0.5, "left");
  drawText(ctx, "24:00", M + CW * 0.5, y, 22 * S, "regular", DIM, CW * 0.5, "right");
  y += Math.round(64 * S);

  // --- C. lista de task-uri ---
  const items = data.reminders.items.slice(0, CONFIG.maxReminders);
  if (items.length) {
    drawText(ctx, "DE FACUT · " + data.reminders.total, M, y, 24 * S,
             "semibold", DIM, CW, "left");
    y += Math.round(44 * S);

    const lh = Math.round(52 * S);
    for (const it of items) {
      if (y + lh > bottom - 50 * S) break;
      const c = it.overdue ? CONFIG.accent : "#48484A";
      dot(ctx, M + 9 * S, y + 17 * S, 9 * S, c);
      drawText(ctx, it.title, M + 32 * S, y, 32 * S, "regular",
               it.overdue ? SOFT : SOFT, CW - 32 * S, "left");
      y += lh;
    }
  }

  // --- D. subsol ---
  // Ancorat sub continut, nu de marginea de jos: notificarile de pe lock screen
  // se stivuiesc de jos in sus si ar acoperi un subsol fixat acolo.
  const fy = Math.min(y + Math.round(16 * S), bottom - Math.round(34 * S));
  const parts = [];
  if (data.weather) parts.push(data.weather.icon + " " + data.weather.temp + "° " + data.weather.label);
  parts.push("actualizat " + String(now.getHours()).padStart(2, "0") + ":" +
             String(now.getMinutes()).padStart(2, "0"));
  drawText(ctx, parts.join("   ·   "), M, fy, 24 * S, "regular", DIM, CW, "left");

  return ctx.getImage();
}

// --- date -----------------------------------------------------------------

function routineState(now) {
  if (!CONFIG.routine.length) return null;
  const sorted = CONFIG.routine.slice().sort((a, b) => minutesOf(a.at) - minutesOf(b.at));
  const cur = now.getHours() * 60 + now.getMinutes();
  let i = sorted.findIndex((r) => minutesOf(r.at) > cur);
  if (i === -1) i = 0;
  return { next: sorted[i].label, nextTime: sorted[i].at };
}

async function getReminders() {
  try {
    let all = await Reminder.allIncomplete();
    if (CONFIG.reminderLists.length) {
      all = all.filter((r) => r.calendar && CONFIG.reminderLists.includes(r.calendar.title));
    }
    all.sort((a, b) => (a.dueDate ? a.dueDate.getTime() : Infinity) -
                       (b.dueDate ? b.dueDate.getTime() : Infinity));
    return {
      total: all.length,
      items: all.map((r) => ({
        title: r.title,
        overdue: !!(r.dueDate && r.dueDate.getTime() < Date.now()),
      })),
    };
  } catch (e) {
    return { total: 0, items: [] };
  }
}

const WEATHER_CODES = {
  0: ["Senin", "☀️"], 1: ["Senin", "🌤"],
  2: ["Noros part.", "⛅"], 3: ["Innorat", "☁️"],
  45: ["Ceata", "🌫"], 48: ["Chiciura", "🌫"],
  51: ["Burnita", "🌦"], 53: ["Burnita", "🌦"],
  55: ["Burnita++", "🌦"], 61: ["Ploaie us.", "🌧"],
  63: ["Ploaie", "🌧"], 65: ["Ploaie++", "🌧"],
  71: ["Ninsoare", "🌨"], 73: ["Ninsoare", "🌨"],
  75: ["Ninsoare++", "❄️"], 80: ["Averse", "🌦"],
  81: ["Averse", "🌧"], 82: ["Averse++", "⛈"],
  95: ["Furtuna", "⛈"], 96: ["Grindina", "⛈"], 99: ["Grindina", "⛈"],
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
    const data = await new Request(
      "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code&timezone=auto&forecast_days=1"
    ).loadJSON();
    const info = WEATHER_CODES[data.current.weather_code] || ["-", "🌡"];
    return { temp: Math.round(data.current.temperature_2m), label: info[0], icon: info[1] };
  } catch (e) {
    return null;
  }
}

// --- entry point -----------------------------------------------------------

const now = new Date();
const [reminders, weather] = await Promise.all([getReminders(), getWeather()]);
const img = buildWallpaper({
  now: now.getTime(),
  routine: routineState(now),
  reminders: reminders,
  weather: weather,
});

// Catre Shortcuts (actiunea "Set Wallpaper Photo" primeste imaginea direct).
Script.setShortcutOutput(img);

// Rulat direct din Scriptable: doar previzualizare, ca sa poti regla CONFIG.band.
if (config.runsInApp) QuickLook.present(img);

Script.complete();
