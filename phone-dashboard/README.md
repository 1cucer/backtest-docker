# Phone Dashboard

Home screen-ul telefonului transformat in tablou de informatii: un widget compact
pe grila + un **dashboard full-screen care se misca in timp real** (ceas cu
secunde, countdown pana la urmatorul pas din rutina, vreme, reminders, calendar).

Totul dintr-un singur fisier, printr-o singura aplicatie (**Scriptable**, gratuita).
Fara server, fara hosting, fara cont.

---

## De ce nu merge "in timp real" direct pe grila de widget-uri

iOS nu permite asta, si e bine de stiut inainte de a pierde timp cu alte apps.
Widget-urile sunt desenate de WidgetKit dintr-un *timeline* pregatit dinainte, iar
sistemul decide cand il reimprospateaza — realist o data la 15-30 de minute, si mai
rar daca bateria e sub ~20% sau daca esti in Low Power Mode. Limita e a sistemului,
nu a aplicatiei: Widgy, Scriptable sau orice altceva lovesc exact acelasi plafon.

Ce se actualizeaza cu adevarat continuu pe iOS:

| Varianta | Cadenta reala | Cost |
|---|---|---|
| Pagina web full-screen (ce face scriptul asta) | secunda cu secunda | gratis, un tap |
| StandBy mode (iOS 17+, pe incarcare, landscape, blocat) | tot widget-uri, dar mereu vizibile | gratis, zero setup |
| Live Activities / Dynamic Island | push, aproape instant | necesita o aplicatie nativa |

**Exceptia:** countdown-urile si datele relative *se anima singure* in widget,
fara refresh — WidgetKit le deseneaza ca text animat (`WidgetDate` +
`applyTimerStyle()` in Scriptable). De asta countdown-ul pana la urmatorul pas
din rutina curge secunda cu secunda si pe grila. Doar **datele** raman blocate
pana la refresh-ul de sistem: reminder-ele, vremea si bateria.

De aceea scriptul are doua moduri: widget pentru grila (privire scurta) si
dashboard live pentru cand proptesti telefonul si te uiti la el.

---

## Instalare

1. Instaleaza **Scriptable** din App Store.
2. Deschide Scriptable → `+` (dreapta sus) → lipeste continutul din `dashboard.js`.
3. Atinge numele scriptului sus si redenumeste-l `Dashboard`.
4. Ruleaza-l o data din Scriptable (butonul ▶). Iti va cere acces la
   **Reminders**, **Calendar** si **Locatie** — accepta-le, altfel raman goale
   sectiunile respective.

### Widget pe home screen

1. Apasa lung pe home screen → `+` → cauta **Scriptable** → alege marimea
   (recomand **Medium** sau **Large**) → Add Widget.
2. Apasa lung pe widget → **Edit Widget**.
3. `Script` → `Dashboard`.
4. `When Interacting` → **Run Script**.

Pasul 4 e important: face ca tap-ul pe widget sa deschida direct dashboard-ul
full-screen, in loc sa deschida Scriptable.

### Iconita separata pentru dashboard-ul live (optional)

Daca vrei si o iconita dedicata, nu doar widget-ul:

1. Shortcuts → `+` → adauga actiunea **Run Script** (din Scriptable) → alege `Dashboard`.
2. Meniul de sus → **Add to Home Screen**, pune-i ce nume si poza vrei.

---

## Configurare

Tot ce e de reglat sta in blocul `CONFIG` din capul fisierului:

```js
const CONFIG = {
  accent: "#FF4A17",        // culoarea de accent
  locale: "ro-RO",
  routine: [                // ROUTINE I - ora + eticheta
    { at: "04:00", label: "WAKE UP" },
    { at: "06:45", label: "START TURA" },
    // ...
  ],
  reminderLists: [],        // [] = toate listele; sau ["ROUTINE I", "Inbox"]
  maxReminders: 7,
  weather: { lat: null, lon: null },  // null = GPS
  refreshMinutes: 15,
};
```

**Orele din `routine` sunt placeholder-e** preluate din screenshot-ul listei
ROUTINE I — schimba etichetele cu ce inseamna de fapt fiecare ora pentru tine.

**`weather.lat/lon`**: daca le lasi `null`, scriptul cere locatia prin GPS. Pentru
widget e mai bine sa pui coordonate fixe (cauta orasul tau pe
[latlong.net](https://www.latlong.net)) — widget-urile ruleaza in fundal si acolo
accesul la locatie e nesigur. Vremea vine de la [Open-Meteo](https://open-meteo.com),
care e gratuit si nu cere cheie de API.

**`reminderLists`**: "Flagged" e o lista inteligenta, nu una reala, deci nu poate fi
filtrata dupa nume. Daca vrei doar anumite liste, foloseste numele listelor reale.

---

## Cand il tii proptit la munca

- **Settings → Display & Brightness → Auto-Lock → Never** cat tii dashboard-ul
  deschis (pune-l inapoi pe 30s dupa, altfel iti arde bateria).
- **Guided Access** (Settings → Accessibility → Guided Access) blocheaza telefonul
  pe dashboard: triplu-click pe butonul lateral ca sa pornesti/opresti. Util daca
  nu vrei sa iasa din el din greseala.
- Daca il tii **pe incarcare, in landscape, blocat**, iOS intra in **StandBy** si
  iti arata widget-urile mari fara niciun setup. Merita incercat in paralel.
- La 12-16% baterie (cat aveai in screenshot-uri) iOS taie agresiv refresh-ul
  widget-urilor. Dashboard-ul full-screen nu e afectat — el ruleaza in prim-plan.

---

## Ce vezi pe ecran

- **Ceasul mare** cu secunde, ziua si data, in romana.
- **Urmatorul pas** din rutina + countdown live + bara de progres intre pasul
  anterior si cel urmator.
- **Rand de statistici**: temperatura si starea vremii, numarul de task-uri
  neterminate, bateria, ora apusului.
- **Lista "De facut"**: reminder-ele neterminate (cele depasite marcate cu
  portocaliu) plus evenimentele ramase din ziua curenta, marcate cu ◇.

Ceasul, countdown-ul si bara de progres se recalculeaza de 4 ori pe secunda.
Vremea se reia singura la 10 minute. Reminder-ele si calendarul se incarca la
deschidere — inchide si redeschide dashboard-ul ca sa le reimprospatezi.

---

## Limitari cunoscute

- **Screen Time nu poate fi citit** de niciun script sau widget terta parte. iOS nu
  expune API-ul. Widget-ul nativ de Screen Time e singura optiune, si el se
  actualizeaza rar.
- Reminder-ele si evenimentele sunt un snapshot de la deschidere, nu un flux live.
- Procentul bateriei din dashboard e citit la deschidere.
- `navigator.wakeLock` e incercat, dar WKWebView nu il onoreaza mereu — de asta
  exista recomandarea cu Auto-Lock de mai sus.

---

# Wallpaper de lock screen (`wallpaper.js`)

Informatia direct pe fundalul de lock screen, ca sa o vezi cand ridici telefonul,
fara niciun tap. Scriptable deseneaza imaginea, Shortcuts o pune ca wallpaper, iar
o automatizare pe ora fixa trage de tot lantul.

E un **instantaneu**, nu ceva live: de aceea afiseaza ore absolute ("URMEAZA 16:00"),
niciodata countdown-uri, care ar fi gresite intre doua actualizari.

## Ce deseneaza

- **URMEAZA** + eticheta pasului curent din rutina + ora lui
- **Banda zilei**: 00:00 → 24:00, cu cate un punct pentru fiecare pas al rutinei
  (aprins daca a trecut), umplut pana in momentul generarii, cu un marcaj alb
  pentru "acum"
- **De facut**: primele 4 task-uri neterminate, cele depasite marcate portocaliu
- **Subsol**: vremea si ora la care s-a generat imaginea

Totul e desenat doar in banda `CONFIG.band` — sub ceasul si widget-urile de
sistem, si suficient de sus cat sa nu fie acoperit de notificari, care se
stivuiesc de jos in sus.

## Setup

**1. Scriptul**

Scriptable → `+` → lipeste `wallpaper.js` → redenumeste-l `Wallpaper`.
Ruleaza-l o data din Scriptable: iti arata o previzualizare (QuickLook) ca sa
poti regla `CONFIG.band` inainte de a-l lega de Shortcuts.

**2. Shortcut-ul**

Shortcuts → `+` → numeste-l `Update Wallpaper`:

1. Actiunea **Run Script** (Scriptable) → alege `Wallpaper`
2. Actiunea **Set Wallpaper Photo** → input-ul e rezultatul scriptului
3. In optiunile acestei actiuni alege **Lock Screen** (nu si Home Screen —
   acolo oricum acopera grila de aplicatii)
4. **Dezactiveaza `Show Preview`** in aceeasi actiune

Pasul 4 nu e optional: cu el pornit, fiecare rulare iti cere confirmare si
automatizarea devine inutila.

**3. Automatizarile**

Shortcuts → tab-ul **Automation** → `+` → **Time of Day** → ora dorita →
**Daily** → **Run Immediately** (si `Notify When Run` oprit) → ruleaza
`Update Wallpaper`.

Atentie: automatizarile de tip Time of Day se repeta doar **zilnic, saptamanal
sau lunar** — nu exista optiune de "din ora in ora". Pentru mai multe
actualizari pe zi, creezi cate o automatizare pentru fiecare moment. In practica
4-5 sunt destule, fixate pe momentele care conteaza:

| Ora | De ce |
|---|---|
| 03:55 | inainte de trezire |
| 06:40 | inainte de plecare |
| 15:00 | inainte de pauza |
| 16:00 | final de tura |
| 22:00 | planul de maine |

Nu doar ora poate fi declansator: **ajungi la o locatie**, **te conectezi la un
Wi-Fi anume**, **pui telefonul la incarcat**, **se schimba Focus-ul** sau
**atingi un tag NFC** functioneaza la fel de bine, si sunt adesea mai potrivite
decat o ora fixa.

## Daca nu merge

- **Cere confirmare la fiecare rulare** → `Show Preview` a ramas pornit in
  actiunea Set Wallpaper Photo.
- **Actiunea refuza imaginea primita direct** → pune intre cele doua actiuni un
  **Save to Photo Album**, apoi hraneste Set Wallpaper Photo cu poza salvata.
- **Wallpaper-ul apare estompat** → lock screen-ul are optiunea proprie de blur.
  Apasa lung pe lock screen → Customize → si opreste efectul.
- **Textul e acoperit de notificari** → coboara `band.bottom` sau tine
  notificarile in Notification Summary.
- **Nu se schimba nimic la ora stabilita** → verifica in automatizare ca e pe
  **Run Immediately**, nu pe "Run After Confirmation".

## Limitari

- Scriptable nu poate seta el wallpaper-ul; Shortcuts e obligatoriu in lant.
- Nu exista automatizare mai deasa de o data pe zi per automatizare.
- `routine` e duplicat intre `dashboard.js` si `wallpaper.js` — Scriptable tine
  scripturile ca fisiere separate. Daca schimbi orele, schimba-le in ambele.
