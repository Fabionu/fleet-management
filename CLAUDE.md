# Fleet Management — Memorie Proiect Claude

## Descriere generală
Aplicație web de management flotă camioane.
- **Frontend**: React + Vite, fișiere `.jsx`
- **Backend**: Node.js, fișier `server.cjs` (Express)
- **Baza de date**: PostgreSQL (variabila de mediu `DATABASE_URL` în `.env`)
- **State management**: Zustand (`src/store/useStore.js`)
- **Stiluri**: CSS custom properties (variabile tematice) în `src/styles/app.css`

---

## Structura proiectului
```
fleet-management-react/
├── server.cjs                  # Backend Express (API REST)
├── database/
│   └── db.cjs                  # Inițializare DB, pool PostgreSQL, migrări
├── src/
│   ├── App.jsx                 # Root component, routing, autentificare
│   ├── main.jsx
│   ├── index.css               # Reset minimal
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Tracking.jsx        # Pagina principală urmărire camioane
│   │   ├── Curse.jsx           # Pagina curse/transporturi
│   │   └── Admin.jsx           # Panou admin (users, camioane, șoferi, jurnal)
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Navigation.jsx
│   │   ├── MainLayout.jsx
│   │   ├── AddTripModal.jsx
│   │   ├── EditTripModal.jsx
│   │   ├── AddCurseModal.jsx
│   │   ├── EditCurseModal.jsx
│   │   ├── InfoVehicleModal.jsx
│   │   ├── TripDocsModal.jsx
│   │   ├── TruckModal.jsx
│   │   └── WeekendModal.jsx
│   ├── services/
│   │   └── api.js              # Funcții fetch către backend
│   ├── store/
│   │   └── useStore.js         # Zustand store
│   └── styles/
│       └── app.css             # Stiluri globale + CSS variables
```

---

## Baza de date — Tabele principale

### `organizations`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| name | TEXT | |

### `users`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| username | TEXT UNIQUE | |
| password | TEXT | bcrypt hash |
| role | TEXT | 'admin' / 'dispatcher' / 'contabil' |
| permissions | TEXT | JSON stringificat |
| organization_id | INTEGER FK | |

### `trucks`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| number | TEXT UNIQUE | Numărul camionului |
| status | TEXT | 'liber' / 'incarcare' / 'descarcare' / 'transit' / 'pauza' / 'weekend' |
| client | TEXT | |
| order_number | TEXT | |
| load_location, unload_location | TEXT | |
| load_date, unload_date | TEXT | |
| load_lat, load_lng | TEXT | Coordonate încărcare |
| unload_lat, unload_lng | TEXT | Coordonate descărcare |
| eta | TEXT | |
| observations | TEXT | |
| pause_date, pause_time | TEXT | |
| weekend_duration, weekend_day, weekend_time, weekend_week | TEXT | |
| weekend_history | TEXT | JSON array |
| drivers | TEXT | |
| phone | TEXT | |
| trailer | TEXT | Număr remorcă |
| fuel_card, fuel_card_expiry | TEXT | |
| amazon_account | INTEGER | 0 sau 1 |
| vignettes | TEXT | JSON array |
| next_trip | TEXT | |
| file_name, file_data, file_type | TEXT | Fișier atașat |
| vehicle_type | TEXT | '40t' / '12t' / '10t' / '7.5t' / '3.5t' (adăugat prin migrare) |
| organization_id | INTEGER FK | |

### `trips`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| client, order_number | TEXT | |
| load_date, unload_date | TEXT | |
| price | REAL | |
| km_empty, km_loaded | REAL | |
| tolls | REAL | |
| truck_number, driver | TEXT | |
| invoiced | INTEGER | 0 sau 1 |
| file_name/data/type | TEXT | CMR sau alt document |
| cmr_file_name/data/type | TEXT | |
| invoice_file_name/data/type | TEXT | |
| load_location, unload_location | TEXT | |
| load_coords, unload_coords | TEXT | |
| created_by | TEXT | Username |
| created_at | TIMESTAMP | |
| organization_id | INTEGER FK | |

### `drivers`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| name | TEXT | |
| organization_id | INTEGER FK | |

### `driver_documents`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| driver_id | INTEGER FK | ON DELETE CASCADE |
| doc_type | TEXT | |
| file_name, file_data, file_type | TEXT | |
| expiry_date | TEXT | |

### `logs`
| Coloană | Tip | Note |
|---------|-----|------|
| id | SERIAL PK | |
| created_at | TIMESTAMP | |
| username | TEXT | |
| action | TEXT | |
| entity_type, entity_id | TEXT | |
| details | TEXT | |
| organization_id | INTEGER FK | |

---

## Roluri și permisiuni (defaultPermissions în db.cjs)

| Permisiune | admin | dispatcher | contabil |
|-----------|-------|------------|---------|
| editVehicleInfo | ✅ | ❌ | ❌ |
| toggleAmazon | ✅ | ❌ | ❌ |
| addTrip | ✅ | ✅ | ❌ |
| editTrip | ✅ | ✅ | ✅ |
| deleteTrip | ✅ | ❌ | ❌ |
| clearTruckData | ✅ | ✅ | ❌ |
| deleteTruckRow | ✅ | ✅ | ❌ |
| addNextTrip | ✅ | ✅ | ❌ |
| markInvoiced | ✅ | ❌ | ✅ |

---

## CSS Variables (src/styles/app.css)

### Light mode (`:root`)
```css
--bg: #fafaf9
--surface: #ffffff
--surface2: #f5f5f3
--border: #e8e8e4
--gray-1: #f0f0ec
--gray-2: #e8e8e4
--gray-3: #c8c8c2
--gray-4: #8a8a82
--black: #111110
--white: #ffffff
--red: #dc2626
--red-light: #fdf0ee
--green: #16a34a
--orange: #ea580c
--blue: #2563eb
```

### Dark mode (`[data-theme="dark"]`)
```css
--bg: #111110
--surface: #1a1a18
--surface2: #222220
--border: #333330
--gray-1: #282826
--gray-2: #323230
--gray-3: #505050
--gray-4: #b8b8b8
--black: #ffffff        ← ATENȚIE: în dark mode --black este ALB (text principal)
--white: #111110
--red: #ef4444
--red-light: #2e1a1a
--green: #22c55e
--orange: #f97316
--blue: #3b82f6
```

> ⚠️ **Regulă importantă**: Folosește ÎNTOTDEAUNA variabile CSS (`var(--red)`, `var(--black)`, etc.) în inline styles, NU culori hex hardcodate. Astfel funcționează corect atât în light cât și în dark mode.

---

## Tipuri vehicule (VEHICLE_TYPES în Admin.jsx)
```js
const VEHICLE_TYPES = [
  { value: '40t',  label: '40t',  color: '#ef4444', desc: 'Semi-remorcher' },
  { value: '12t',  label: '12t',  color: '#f59e0b', desc: 'Rigid 12t' },
  { value: '10t',  label: '10t',  color: '#3b82f6', desc: 'Rigid 10t' },
  { value: '7.5t', label: '7.5t', color: '#8b5cf6', desc: 'Rigid 7.5t' },
  { value: '3.5t', label: '3.5t', color: '#22c55e', desc: 'Dubă / Van' },
];
```
Fiecare tip are un SVG distinct (VehicleIcon) și un badge colorat (VehicleBadge) în tabelul din Admin.

---

## Pattern butoane iconițe (Admin.jsx — iconBtnBase)
```js
const iconBtnBase = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid var(--gray-3)',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  transition: 'all 0.15s',
  fontSize: '12px', fontWeight: 500,
};

// Buton Editează:
style={{ ...iconBtnBase, color: 'var(--black)' }}
onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}

// Buton Șterge:
style={{ ...iconBtnBase, color: 'var(--red)' }}
onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
```
> ⚠️ Folosește `e.currentTarget` (NU `e.target`) în hover handlers pentru a evita aplicarea stilului pe child elements!

---

## Panoul Admin (src/pages/Admin.jsx)
4 secțiuni navigabile cu carduri:
1. **Utilizatori** (SectionUtilizatori) — CRUD users, roluri, permisiuni
2. **Camioane** (SectionCamioane) — CRUD camioane, tip vehicul, documente
3. **Șoferi** (SectionSoferi) — CRUD șoferi, documente (permis, pașaport, card tahograf, etc.)
4. **Jurnal activitate** (SectionJurnal) — logs readonly

Navigarea e salvată în `localStorage` (cheia: `adminActiveSection`).

---

## Tracking.jsx — Filtrare
- **Search input**: caută în `number`, `client`, `order_number`, `drivers`, `load_location`, `unload_location`
- **Dropdown status**: filtrare după statusul camionului
- **Counter**: `{filteredTrucks.length} / {trucks.length} vehicule`

```js
const filteredTrucks = trucks.filter(t => {
  if (filter !== 'all' && t.status !== filter) return false;
  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    const haystack = [t.number, t.client, t.order_number, t.drivers, t.load_location, t.unload_location]
      .filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
});
```

---

## Migrări DB (database/db.cjs)
- Migrările se fac cu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` la pornirea serverului
- Coloana `vehicle_type TEXT` a fost adăugată la tabelul `trucks`

---

## Useri default (creați automat la prima pornire)
| Username | Parolă | Rol |
|----------|--------|-----|
| admin | admin | admin |
| Fabio | Tofan2308! | dispatcher |
| Marcel | 123 | dispatcher |

---

## Comenzi utile
```bash
# Pornire server backend
node server.cjs

# Pornire frontend dev
npm run dev

# Build producție
npm run build
```

---

## Decizii tehnice importante
1. **Nu folosi hex hardcodat în inline styles** — întotdeauna `var(--culoare)` pentru compatibilitate light/dark mode
2. **`e.currentTarget` vs `e.target`** — în hover handlers pe butoane cu child elements, folosește `currentTarget`
3. **PostgreSQL** via `DATABASE_URL` în `.env` — nu SQLite (fișierul `fleet.db` din `/database` e vechi/nefolosit)
4. **Fișierele se stochează ca base64** în coloana `file_data` direct în DB
5. **Organizații multiple** — fiecare resursă are `organization_id` pentru multi-tenancy
