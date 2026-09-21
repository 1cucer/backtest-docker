# Full Native Build

Zero cod. Doar Shortcuts + Reminders + Calendar + Focus, native iOS.
Inlocuieste `dashboard.js` / `focus.js` / `wallpaper.js` (Scriptable) ca varianta
principala. Scripturile Scriptable raman in repo ca varianta alternativa, daca
te razgandesti — nu sunt sterse, doar nu mai sunt drumul recomandat.

## Ce pierzi fata de Scriptable, cinstit spus

- **Wallpaper-ul generat (bare, inele desenate)** nu are echivalent nativ direct.
  Shortcuts poate pune text peste o poza (`Add Caption to Image`), dar nu poate
  desena progres grafic. Compensat partial de widget-urile de lock screen de mai
  jos, care sunt native si interactive, dar nu identice vizual.
- **Zilele-din-luna calculate automat** sunt mai fragile in Shortcuts decat in
  JS (vezi nota de la Shortcut 3). Solutia: o actualizezi manual, o data pe
  luna, 10 secunde.
- **Capitalul curent** nu se citeste automat din nicio sursa — il actualizezi tu
  printr-un reminder, cand se schimba.

## Ce castigi

- Zero cod de intretinut, nimic care se poate rupe la un update de iOS.
- Widget-uri **interactive**: bifezi un reminder direct pe home screen.
- Integrare completa cu **Focus**: paginile se schimba singure la ora potrivita.

---

## 0. Obiectele de baza (le creezi o singura data)

**Reminders — liste noi:**
| Lista | Rol |
|---|---|
| `⟁ CLIMB` | cele 4 randuri calculate, afisate de widget |
| `SYSTEM` | reminders ascunse, folosite ca variabile (marker-e, capital, wake) |
| `#calls` | smart list, filtru pe eticheta `calls` |
| `#build` | smart list, filtru pe eticheta `build` |

**Reminders — in `SYSTEM`, creezi manual acum:**
- `capital` — Notes: valoarea curenta in EUR (ex: `810`). Actualizezi manual cand se schimba.
- `wake_log` — Notes: gol la inceput, il scrie Shortcut-ul `🌅 WAKE`.
- `__deep_running__` — NU o creezi acum. O creeaza/sterge Shortcut-ul `▶ DEEP` singur.

**Calendar — un calendar nou:**
- `DEEP` — aici se scriu blocurile de lucru logate prin `▶ DEEP`.

---

## 1. Shortcut `🌅 WAKE` (un tap, la trezire)

Scop: inregistreaza ora reala de trezire, ca `⟁ CLIMB` sa poata calcula
intarzierea fata de deadline-ul de 07:30.

1. **Find Reminders** — List is `SYSTEM`, Title is `wake_log`
2. **Set Reminder** (pe rezultat) — Notes = *Current Date* (format ISO 8601)
3. **Show Notification** — "Wake logged — [Current Date, format Short Time]"

Pune-l ca **prima actiune din automatizarea de dimineata** (vezi tabelul de
automatizari) SAU ca shortcut separat pe Action Button, apasat manual la trezire —
a doua varianta e mai corecta, pentru ca automatizarea pe ora fixa ruleaza
oricum te-ai trezit, nu cand chiar te trezesti.

---

## 2. Shortcut `▶ DEEP` (start/stop, un singur shortcut, doua stari)

Scop: masoara timp de lucru real si il scrie ca eveniment in calendarul `DEEP`,
cu o eticheta de tip (`#build`, `#calls`, `#trade`, `#learn`, `#shift`).

1. **Find Reminders** — List is `SYSTEM`, Title is `__deep_running__`
2. **If** — Count(Reminders) is 0
   - **Otherwise** (nu ruleaza inca → START):
     3. **Add New Reminder** — List `SYSTEM`, Title `__deep_running__`,
        Notes = *Current Date* (ISO 8601)
     4. **Show Notification** — "▶ Started — [Current Date, Short Time]"
   - **If** (ruleaza deja → STOP):
     3. **Text** — preia Notes din reminder-ul gasit (ora de start)
     4. **Choose from Menu** — optiuni: `build`, `calls`, `trade`, `learn`, `shift`
     5. **Create Calendar Event** — Calendar `DEEP`,
        Start Date = Text de la pasul 3 (parsat ca Date),
        End Date = *Current Date*,
        Title = rezultatul din Choose from Menu (ex: `build`)
     6. **Remove Reminders** — reminder-ul `__deep_running__` gasit la pasul 1
     7. **Calculate** — (Unix(End) − Unix(Start)) ÷ 60, rotunjit → minute
     8. **Show Notification** — "■ Logged [minute]m → #[tag]"

Pune-l pe **Action Button** (15 Pro+) sau in Control Center. E singurul buton pe
care-l apesi de doua ori pe zi: start si stop.

---

## 3. Shortcut `⟁ CLIMB` (motorul — recalculeaza si rescrie lista)

Scop: recompune cele 4 randuri din lista `⟁ CLIMB`, pornind din calendarul
`DEEP` si din reminder-ele `SYSTEM`.

**Constante** (le pui in Shortcut ca actiuni `Text`, editabile oricand):
```
ERA_START      = 2025-11-11
ERA_END        = 2026-11-11
MILESTONE_28   = 2030-11-11
HOURS_TARGET   = 210
CAPITAL_TARGET = 1000000
SHIFT_START    = 15:05
```

**Pasul A — % din ERA:**
1. **Format Date** ERA_START → Unix Time → `A`
2. **Format Date** ERA_END → Unix Time → `B`
3. **Format Date** Current Date → Unix Time → `N`
4. **Calculate** `(N-A)/(B-A)*100` → `era_pct`
5. **Calculate** `(B-N)/86400` → `era_days_left`

**Pasul B — HOURS luna curenta:**
6. **Find Calendar Events** — Calendar is `DEEP`, Start Date is *this month*
7. **Repeat with Each** (peste evenimente):
   - **Get Details of Calendar Event** → Duration (minute)
   - **Add to Variable** `total_min`
8. **Calculate** `total_min/60` → `hours_done`
9. **Calculate** `hours_done/HOURS_TARGET*100` → `hours_pct`
10. Zile ramase in luna — **vezi nota fragila mai jos**
11. **Calculate** `(HOURS_TARGET-hours_done)/days_left` → `rate_needed`

> **Nota fragila**: Shortcuts nu are o actiune directa "zile ramase in luna".
> Trucul (Adjust Date la 1 a lunii viitoare, apoi −1 zi) e nesigur in unele
> versiuni de iOS. **Solutie robusta**: pui `days_in_month` ca a saptea
> constanta text, si o actualizezi manual o data pe luna (30 secunde). E un
> compromis, dar unul care nu se rupe niciodata silentios.

**Pasul C — MILLIONAIRE:**
12. **Format Date** MILESTONE_28 → Unix Time → `M`
13. **Calculate** `(M-N)/86400` → `days_to_milestone`
14. **Find Reminders** — List `SYSTEM`, Title `capital` → Notes → `capital_now`
15. **Calculate** `capital_now/CAPITAL_TARGET*100` → `capital_pct`

**Pasul D — WAKE DEADLINE:**
16. **Find Reminders** — List `SYSTEM`, Title `wake_log` → Notes → `wake_time`
17. **Calculate** diferenta in minute fata de 07:30 → `wake_delta`

**Pasul E — bare vizuale** (repeta pentru fiecare % din A/B/C):
18. **Calculate** `ROUND(pct/10)` → `filled`
19. **Repeat** `filled` ori → **Combine Text** adauga `▰`
20. **Repeat** `10-filled` ori → **Combine Text** adauga `▱`

**Pasul F — scrie randurile:**
21. **Find Reminders** — List `⟁ CLIMB` → **Remove Reminders** (toate)
22. **Add New Reminder** ×4, List `⟁ CLIMB`:
    - `ERA 23 · FOREIGN  [bar]  [era_pct]%  ·  [era_days_left]d`
    - `HOURS  [bar]  [hours_done]/210  ·  need [rate_needed] h/d`
    - `28 · MILLIONAIRE  [bar]  [capital_pct]%  ·  [days_to_milestone]d`
    - `WAKE DEADLINE 07:30  ·  [wake_delta]`

---

## 4. Automatizari (Shortcuts → Automation → Time of Day → Daily → Run Immediately, `Notify When Run` oprit)

| Ora | Ruleaza | Efect |
|---|---|---|
| 06:00 | `⟁ CLIMB` | recalculeaza inainte sa te trezesti |
| 07:30 | (alarma nativa, nu Shortcut) | te trezesti la deadline |
| 14:45 | `⟁ CLIMB` | ultima citire inainte de tura |
| 15:05 | **Start Timer** 5h 20m | numaratoare pana la pauza |
| 20:25 | **Start Timer** 35m | numaratoare pana la intoarcere |
| 21:00 | **Start Timer** 2h 25m | numaratoare pana la final |
| 23:30 | `⟁ CLIMB` | recalculeaza dupa tura |
| Duminica 10:00 | (manual) `▲ SUMMON THE INSTRUMENT` | revizuirea saptamanala din Codex Vitae |

---

## 5. Focus (comutarea automata a paginilor)

`Settings → Focus → +`

1. **"The Climb"** — Schedule 07:30–14:30, zilnic. `Customize Screens` → Home Screen → doar Pagina 1.
2. **"The Shift"** — Schedule 14:30–23:25, zilnic. `Customize Screens` → Home Screen → doar Pagina 2.

Fiecare Focus poate avea si propriul Lock Screen — leaga-l din aceeasi ecran de
setari daca vrei lock screen diferit in tura fata de restul zilei.

---

## 6. Asamblarea home screen-ului

**Pagina 1 — "The Climb":**
- Widget **Reminders, large**, fixat pe lista `⟁ CLIMB`
- Widget **Reminders, medium**, fixat pe smart list `#calls`
- restul paginii: goala. Aplicatiile stau in dock si App Library.

**Pagina 2 — "The Shift":**
- Widget **Shortcuts, medium** — 4 actiuni: `▶ DEEP`, log rapid, etc.
- Widget **Clock, small** — timerul activ (pornit de automatizare)
- Widget **Music/Podcasts, small**

**Lock screen:**
- Widget **Reminders, accessoryRectangular** — primul rand din `⟁ CLIMB` (Wake Deadline)
- Widget **Reminders, accessoryRectangular** — al doilea rand (Hours)

---

## 7. Intretinere manuala (costul renuntarii la cod)

O data pe luna (30 secunde): actualizezi `days_in_month` in Shortcut-ul `⟁ CLIMB`.
Cand se schimba: actualizezi Notes-ul reminder-ului `capital` in `SYSTEM`.
Restul e complet automat.
