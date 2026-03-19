import { useState, useEffect, useCallback } from 'react';
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

// ── Card sumar ────────────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
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

// ── Componenta principală ─────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod]        = useState('luna');
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
    setLoading(true);
    try {
      const { from, to } = getPeriodDates(period);
      const params = {};
      if (from)   params.from   = from;
      if (to)     params.to     = to;
      if (truck)  params.truck  = truck;
      if (driver) params.driver = driver;
      const res = await api.getDashboardStats(params);
      setData(res.data);
    } catch (e) {
      console.error('Dashboard stats error:', e);
    } finally {
      setLoading(false);
    }
  }, [period, truck, driver]);

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
          <Sel value={period} onChange={p => { setPeriod(p); setShowAllUninv(false); }} options={periodOptions} />
          <Sel value={truck}  onChange={setTruck}  options={truckOptions} />
          <Sel value={driver} onChange={setDriver} options={driverOptions} />
          {loading && (
            <div style={{ width: 16, height: 16, border: '2px solid var(--gray-2)', borderTopColor: '#ff7a3d', borderRadius: '50%', animation: 'dashSpin 0.6s linear infinite' }} />
          )}
        </div>
      </div>

      {/* ── Carduri sumar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <SummaryCard icon="🚛" label="Total curse"     value={fmt(s.total_trips)}       sub="Perioadă selectată" />
        <SummaryCard icon="💶" label="Venituri totale" value={fmtEur(s.total_revenue)}  sub={`Taxe drumuri: ${fmtEur(s.total_tolls)}`} color="var(--green)" />
        <SummaryCard icon="📍" label="Km parcurși"     value={fmtKm(totalKm)}           sub={`Încărc.: ${fmtKm(s.total_km_loaded)} · Goi: ${fmtKm(s.total_km_empty)}`} />
        <SummaryCard icon="⚠️" label="Nefacturate"     value={fmt(s.uninvoiced_count)}  sub={`Valoare: ${fmtEur(s.uninvoiced_revenue)}`} color="var(--orange)" />
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
