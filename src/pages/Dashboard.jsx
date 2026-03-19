import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { api } from '../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (n) => Number(n || 0).toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEur = (n) => `€ ${fmt(n)}`;
const fmtKm  = (n) => `${fmt(n)} km`;

function getPeriodDates(period) {
  const now = new Date();
  const to  = new Date(now);
  to.setHours(23, 59, 59, 999);
  let from = null;
  if (period === 'luna') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'luna_trecuta') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to.setFullYear(now.getFullYear(), now.getMonth(), 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === '3luni') {
    from = new Date(now); from.setMonth(from.getMonth() - 3);
  } else if (period === '6luni') {
    from = new Date(now); from.setMonth(from.getMonth() - 6);
  } else if (period === 'an') {
    from = new Date(now); from.setFullYear(from.getFullYear() - 1);
  }
  return { from: from ? from.toISOString() : undefined, to: to.toISOString() };
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ fontWeight: 600, color: 'var(--black)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name === 'revenue' ? fmtEur(p.value) : p.name === 'km' ? fmtKm(p.value) : `${fmt(p.value)} curse`}
        </div>
      ))}
    </div>
  );
};

// ── Iconițe SVG ──────────────────────────────────────────────────────────────
const IconTruck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h15v13H1z"/>
    <path d="M16 8h4l3 4v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IconTrendingUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconRoute = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="19" r="3"/>
    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
    <circle cx="18" cy="5" r="3"/>
  </svg>
);
const IconAlertTriangle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ── Card sumar ────────────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ color: color || 'var(--gray-4)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--black)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>{sub}</div>}
    </div>
  );
}

// ── Select stilizat ──────────────────────────────────────────────────────────
function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: '7px 10px', border: '1px solid var(--gray-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--black)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Secțiune grafic ───────────────────────────────────────────────────────────
function ChartSection({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Custom DatePicker ─────────────────────────────────────────────────────────
const MONTHS_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const DOW_RO    = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'];

function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(null);
  const [viewMonth, setViewMonth] = useState(null);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const todayStr = new Date().toISOString().split('T')[0];

  const formatDisplay = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  };

  const getDays = () => {
    if (viewYear === null) return [];
    const firstDow  = new Date(viewYear, viewMonth, 1).getDay();
    const lastDate  = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOff  = (firstDow + 6) % 7; // Monday first
    const days = [];
    for (let i = startOff - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth, -i),     cur: false });
    for (let d = 1; d <= lastDate; d++)     days.push({ date: new Date(viewYear, viewMonth, d),       cur: true  });
    const rem = 42 - days.length;
    for (let d = 1; d <= rem; d++)          days.push({ date: new Date(viewYear, viewMonth + 1, d),   cur: false });
    return days;
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleOpen = () => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(o => !o);
  };

  const handleDay = (date) => {
    onChange(date.toISOString().split('T')[0]);
    setOpen(false);
  };

  const handleToday = () => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    onChange(d.toISOString().split('T')[0]);
    setOpen(false);
  };

  const days = getDays();

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <div onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid var(--gray-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: value ? 'var(--black)' : 'var(--gray-4)', cursor: 'pointer', userSelect: 'none', minWidth: 120, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{value ? formatDisplay(value) : (placeholder || 'De la')}</span>
        </div>
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange(''); }}
            style={{ fontSize: 16, lineHeight: 1, color: 'var(--gray-4)', fontWeight: 300, marginLeft: 2 }}>×</span>
        )}
      </div>

      {/* Popover calendar */}
      {open && viewYear !== null && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1100, background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 12, padding: '14px 14px 10px', boxShadow: '0 8px 28px rgba(0,0,0,0.13)', width: 252 }}>

          {/* Month / Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '3px 7px', borderRadius: 6, fontSize: 17, lineHeight: 1, fontFamily: 'inherit' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>{MONTHS_RO[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '3px 7px', borderRadius: 6, fontSize: 17, lineHeight: 1, fontFamily: 'inherit' }}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DOW_RO.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', letterSpacing: '0.03em', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {days.map(({ date, cur }, i) => {
              const str        = date.toISOString().split('T')[0];
              const isSelected = str === value;
              const isToday    = str === todayStr;
              return (
                <button key={i} onClick={() => handleDay(date)}
                  style={{
                    padding: '5px 0', textAlign: 'center', fontSize: 12, lineHeight: 1, fontFamily: 'inherit',
                    fontWeight: isToday ? 700 : 400,
                    border: isToday && !isSelected ? '1.5px solid #ff7a3d' : '1.5px solid transparent',
                    borderRadius: 6, cursor: 'pointer',
                    background: isSelected ? '#ff7a3d' : 'transparent',
                    color: isSelected ? '#fff' : cur ? 'var(--black)' : 'var(--gray-3)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--gray-1)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer — Azi */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--gray-2)', display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleToday}
              style={{ background: 'none', border: 'none', fontSize: 12, color: '#ff7a3d', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', padding: '2px 10px' }}>
              Azi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componenta principală ─────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod]        = useState('luna');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [truck, setTruck]          = useState('');
  const [driver, setDriver]        = useState('');
  const [trucks, setTrucks]        = useState([]);
  const [drivers, setDrivers]      = useState([]);
  const [data, setData]            = useState(null);
  const [loading, setLoading]      = useState(false);
  const [showAllUninv, setShowAllUninv] = useState(false);

  useEffect(() => {
    api.getTrucks().then(r  => setTrucks(r.data  || [])).catch(() => {});
    api.getDrivers().then(r => setDrivers(r.data || [])).catch(() => {});
  }, []);

  const loadStats = useCallback(async () => {
    // La perioadă custom nu trimite nimic dacă n-a ales nicio dată
    if (period === 'custom' && !customFrom && !customTo) return;
    setLoading(true);
    try {
      const params = {};
      if (period === 'custom') {
        if (customFrom) params.from = new Date(customFrom).toISOString();
        if (customTo)   { const d = new Date(customTo); d.setHours(23, 59, 59, 999); params.to = d.toISOString(); }
      } else {
        const { from, to } = getPeriodDates(period);
        if (from) params.from = from;
        if (to)   params.to   = to;
      }
      if (truck)  params.truck  = truck;
      if (driver) params.driver = driver;
      const res = await api.getDashboardStats(params);
      setData(res.data);
    } catch (e) {
      console.error('Dashboard stats error:', e);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, truck, driver]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const s        = data?.summary || {};
  const totalKm  = Number(s.total_km_loaded || 0) + Number(s.total_km_empty || 0);
  const uninvList = data?.uninvoiced || [];
  const visibleUninv = showAllUninv ? uninvList : uninvList.slice(0, 10);

  const periodOptions = [
    { value: 'luna',         label: 'Luna curentă' },
    { value: 'luna_trecuta', label: 'Luna trecută' },
    { value: '3luni',        label: 'Ultimele 3 luni' },
    { value: '6luni',        label: 'Ultimele 6 luni' },
    { value: 'an',           label: 'Ultimul an' },
    { value: 'tot',          label: 'Tot timpul' },
    { value: 'custom',       label: 'Perioadă personalizată' },
  ];
  const truckOptions  = [{ value: '', label: 'Toate camioanele' }, ...trucks.map(t  => ({ value: t.number, label: t.number }))];
  const driverOptions = [{ value: '', label: 'Toți șoferii' },     ...drivers.map(d => ({ value: d.name,   label: d.name   }))];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Header + Filtre ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--black)' }}>Rapoarte</div>
          <div style={{ fontSize: 13, color: 'var(--gray-4)', marginTop: 2 }}>Statistici și analiză flotă</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Sel value={period} onChange={p => { setPeriod(p); setCustomFrom(''); setCustomTo(''); setShowAllUninv(false); }} options={periodOptions} />
          {period === 'custom' && (
            <>
              <DatePicker value={customFrom} onChange={setCustomFrom} placeholder="De la" />
              <span style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</span>
              <DatePicker value={customTo} onChange={setCustomTo} placeholder="Până la" />
            </>
          )}
          <Sel value={truck}  onChange={setTruck}  options={truckOptions} />
          <Sel value={driver} onChange={setDriver} options={driverOptions} />
          {loading && (
            <div style={{ width: 16, height: 16, border: '2px solid var(--gray-2)', borderTopColor: '#ff7a3d', borderRadius: '50%', animation: 'dashSpin 0.6s linear infinite' }} />
          )}
        </div>
      </div>

      {/* ── Carduri sumar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <SummaryCard icon={<IconTruck />}         label="Total curse"     value={fmt(s.total_trips)}       sub="Perioadă selectată" />
        <SummaryCard icon={<IconTrendingUp />}    label="Venituri totale" value={fmtEur(s.total_revenue)}  sub={`Taxe drumuri: ${fmtEur(s.total_tolls)}`} color="var(--green)" />
        <SummaryCard icon={<IconRoute />}         label="Km parcurși"     value={fmtKm(totalKm)}           sub={`Încărc.: ${fmtKm(s.total_km_loaded)} · Goi: ${fmtKm(s.total_km_empty)}`} color="var(--blue)" />
        <SummaryCard icon={<IconAlertTriangle />} label="Nefacturate"     value={fmt(s.uninvoiced_count)}  sub={`Valoare: ${fmtEur(s.uninvoiced_revenue)}`} color="var(--orange)" />
      </div>

      {/* ── Grafice rând 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <ChartSection title="Curse per săptămână (ultimele 8 săpt.)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.weeklyTrips || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-2)" vertical={false} />
              <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: 'var(--gray-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--gray-4)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--gray-1)' }} />
              <Bar dataKey="trips" name="trips" fill="#ff7a3d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Venituri per lună (ultimele 12 luni)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data?.monthlyRevenue || []} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-2)" vertical={false} />
              <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: 'var(--gray-4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--gray-4)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--gray-3)', strokeWidth: 1 }} />
              <Area dataKey="revenue" name="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* ── Top camioane ── */}
      {(data?.topTrucks?.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <ChartSection title="Top camioane după venituri">
            <ResponsiveContainer width="100%" height={Math.max(160, data.topTrucks.length * 36)}>
              <BarChart data={data.topTrucks} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-2)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--gray-4)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <YAxis type="category" dataKey="truck_number" tick={{ fontSize: 12, fill: 'var(--black)', fontWeight: 600 }} axisLine={false} tickLine={false} width={65} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--gray-1)' }} />
                <Bar dataKey="revenue" name="revenue" fill="#ff7a3d" radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 11, fill: 'var(--gray-4)', formatter: v => fmtEur(v) }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </div>
      )}

      {/* ── Tabel curse nefacturate ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>Curse nefacturate</span>
            {uninvList.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--orange)', color: '#fff', padding: '1px 7px', borderRadius: 20 }}>
                {uninvList.length}
              </span>
            )}
          </div>
          {uninvList.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--gray-4)' }}>Total: {fmtEur(s.uninvoiced_revenue)}</span>
          )}
        </div>

        {uninvList.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--gray-4)', fontSize: 13 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
            <div>Toate cursele sunt facturate</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--gray-1)' }}>
                    {['Client', 'Nr. comandă', 'Camion', 'Șofer', 'Dată încărcare', 'Dată descărcare', 'Preț'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUninv.map((t, i) => (
                    <tr key={t.id} style={{ borderTop: '1px solid var(--gray-2)', background: i % 2 === 0 ? 'transparent' : 'var(--gray-1)' }}>
                      <td style={{ padding: '9px 14px', color: 'var(--black)', fontWeight: 500 }}>{t.client || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--gray-4)' }}>{t.order_number || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--black)', fontWeight: 600 }}>{t.truck_number || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--gray-4)' }}>{t.driver || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{t.load_date || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{t.unload_date || '—'}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--green)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtEur(t.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {uninvList.length > 10 && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--gray-2)', textAlign: 'center' }}>
                <button onClick={() => setShowAllUninv(p => !p)}
                  style={{ background: 'none', border: 'none', fontSize: 13, color: '#ff7a3d', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  {showAllUninv ? '↑ Arată mai puțin' : `↓ Arată toate (${uninvList.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes dashSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
