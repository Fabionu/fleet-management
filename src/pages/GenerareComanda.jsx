import { useState, useRef, useCallback, useEffect } from 'react';

const FONT = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

let _uid = 0;
const uid = () => ++_uid;

const newStop = (type) => ({
  id: uid(),
  type, // 'incarcare' | 'descarcare' | 'vama'
  date: '', time: '',
  company: '', street: '', city: '',
  coords: '',
  details: '',
  ref: '',
});

const EMPTY_FIELDS = { order_number: '', client: '' };
const DEFAULT_STOPS = () => [newStop('incarcare'), newStop('descarcare')];

// Normalize address key for cache lookup
const makeAddrKey = (street, city) =>
  [street, city].filter(Boolean).map(s => s.trim().toLowerCase()).join('|');

const DIRECT_RE = /^(asap|direct|directly)$/i;
function fmtTime(t) {
  if (!t || DIRECT_RE.test(t.trim())) return 'Direct';
  return `LA ORA ${t}`;
}

function fmtCoord(coords) {
  if (!coords) return 'NORD - EST __________, __________';
  const match = coords.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
  if (!match) return `NORD - EST ${coords}`;
  const latStr = match[1], lngStr = match[2];
  const latDir = latStr.startsWith('-') ? 'SUD' : 'NORD';
  const lngDir = lngStr.startsWith('-') ? 'VEST' : 'EST';
  return `${latDir} - ${lngDir} ${latStr}, ${lngStr}`;
}

function buildWhatsApp(fields, stops) {
  const lines = [
    `*•NUMĂR COMANDĂ:* ${fields.order_number || '___________'}`,
    `*•NUME CLIENT:* ${fields.client || '___________'}`,
    ``,
  ];
  const incarcari  = stops.filter(s => s.type === 'incarcare');
  const descarcari = stops.filter(s => s.type === 'descarcare');
  const vami       = stops.filter(s => s.type === 'vama');
  const multiInc   = incarcari.length > 1;
  const multiDesc  = descarcari.length > 1;
  const multiVama  = vami.length > 1;

  incarcari.forEach((stop, i) => {
    const suffix = multiInc ? ` ${i + 1}` : '';
    const addr = [stop.company, stop.street, stop.city].filter(Boolean).join('\n') || '___________';
    lines.push(`*•ÎNCĂRCARE${suffix} ${stop.date || '___'}, ${fmtTime(stop.time)}, LA ADRESA:*`);
    lines.push(``); lines.push(addr); lines.push(``);
    lines.push(`*•COORDONATE INCARCARE${suffix}:*`);
    lines.push(fmtCoord(stop.coords)); lines.push(``);
    lines.push(`*•DETALII INCARCARE:*${stop.details ? ' ' + stop.details : ''}`);
    if (stop.ref) lines.push(`*•REFERINTA:* ${stop.ref}`);
    lines.push(``);
  });

  vami.forEach((stop, i) => {
    const suffix = multiVama ? ` ${i + 1}` : '';
    const loc = [stop.city, stop.ref].filter(Boolean).join(' — ') || '___________';
    lines.push(`*•VAMĂ${suffix} ${stop.date || '___'}${stop.time ? ', ' + fmtTime(stop.time) : ''}:*`);
    lines.push(loc); lines.push(``);
  });

  descarcari.forEach((stop, i) => {
    const suffix = multiDesc ? ` ${i + 1}` : '';
    const addr = [stop.company, stop.street, stop.city].filter(Boolean).join('\n') || '___________';
    lines.push(`*•DESCĂRCARE${suffix} ${stop.date || '___'}, ${fmtTime(stop.time)}, LA ADRESA:*`);
    lines.push(``); lines.push(addr); lines.push(``);
    lines.push(`*•COORDONATE DESCARCARE${suffix}:*`);
    lines.push(fmtCoord(stop.coords));
    if (stop.ref) lines.push(`\n*•REFERINTA:* ${stop.ref}`);
    lines.push(``);
  });

  return lines.join('\n');
}

// ── Styles ────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 12px', fontSize: '13px',
  border: '1px solid transparent', borderRadius: '8px',
  background: 'var(--gray-1)', color: 'var(--black)',
  outline: 'none', fontFamily: FONT, transition: 'border-color 0.15s',
};
const labelStyle = {
  fontSize: '11px', fontWeight: 600, color: 'var(--gray-4)',
  textTransform: 'uppercase', letterSpacing: '0.07em',
  marginBottom: '4px', display: 'block', fontFamily: FONT,
};
const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: '3px 5px', borderRadius: '5px', display: 'flex',
  alignItems: 'center', transition: 'background 0.12s, color 0.12s', flexShrink: 0,
};

function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''} rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e  => e.target.style.borderColor = 'transparent'} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''} style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e  => e.target.style.borderColor = 'transparent'} />
      )}
    </div>
  );
}

// ── Inline type selector ──────────────────────────────────────
const STOP_OPTS = [
  { type: 'incarcare',  label: 'Încărcare',  dot: '#16a34a', color: 'var(--green)'  },
  { type: 'descarcare', label: 'Descărcare', dot: '#ea580c', color: 'var(--orange)' },
  { type: 'vama',       label: 'Vamă',       dot: '#2563eb', color: 'var(--blue)'   },
];

function TypeSelector({ type, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const current = STOP_OPTS.find(o => o.type === type) || STOP_OPTS[0];

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', border: '1px solid var(--gray-3)', borderRadius: '5px', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: current.color, fontFamily: FONT, transition: 'all 0.12s', letterSpacing: '0.04em' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: current.dot, flexShrink: 0 }} />
        {current.label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 200, minWidth: 130 }}>
          {STOP_OPTS.map(opt => (
            <button
              key={opt.type}
              onClick={() => { onChange(opt.type); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: opt.type === type ? 'var(--gray-1)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: opt.type === type ? 600 : 400, color: opt.type === type ? opt.color : 'var(--black)', fontFamily: FONT, textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (opt.type !== type) e.currentTarget.style.background = 'var(--gray-1)'; }}
              onMouseLeave={e => { if (opt.type !== type) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />
              {opt.label}
              {opt.type === type && <svg style={{ marginLeft: 'auto' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── StopBlock — fields for one stop ──────────────────────────
function StopBlock({ stop, index, total, onUpdate, onMove, onDelete, canDelete, onChangeType, copiedId, onCopyAddr }) {
  const isInc  = stop.type === 'incarcare';
  const isDesc = stop.type === 'descarcare';
  const isVama = stop.type === 'vama';
  const set = (key) => (val) => onUpdate(stop.id, key, val);

  // Coordinate cache state
  const [cachedCoords, setCachedCoords] = useState(null);
  const [coordsSaved,  setCoordsSaved]  = useState(false);
  const [savingCoords, setSavingCoords] = useState(false);

  // Check cache when street/city changes (only if coords not filled)
  useEffect(() => {
    if (isVama) return;
    const key = makeAddrKey(stop.street, stop.city);
    if (!key || stop.coords) { setCachedCoords(null); return; }
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/location-cache?q=${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCachedCoords(data.coords || null);
      } catch { setCachedCoords(null); }
    }, 600);
    return () => clearTimeout(timer);
  }, [stop.street, stop.city, stop.coords, isVama]);

  const handleSaveCoords = async () => {
    const key = makeAddrKey(stop.street, stop.city);
    if (!key || !stop.coords) return;
    setSavingCoords(true);
    try {
      const token = localStorage.getItem('authToken');
      await fetch('/api/location-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          address_key: key,
          display_name: [stop.company, stop.street, stop.city].filter(Boolean).join(', '),
          coords: stop.coords,
        }),
      });
      setCoordsSaved(true);
    } finally { setSavingCoords(false); }
  };

  useEffect(() => { setCoordsSaved(false); }, [stop.coords]);

  const handleApplyCache = () => {
    if (cachedCoords) { onUpdate(stop.id, 'coords', cachedCoords); setCachedCoords(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* controls: type selector left, reorder+delete right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '-4px' }}>
        <TypeSelector type={stop.type} onChange={(newType) => onChangeType(stop.id, newType)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {total > 1 && <>
            <button onClick={() => onMove(index, -1)} disabled={index === 0} title="Mută sus"
              style={{ ...iconBtn, color: index === 0 ? 'var(--gray-3)' : 'var(--gray-4)', cursor: index === 0 ? 'default' : 'pointer' }}
              onMouseEnter={e => { if (index > 0) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = index === 0 ? 'var(--gray-3)' : 'var(--gray-4)'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button onClick={() => onMove(index, 1)} disabled={index === total - 1} title="Mută jos"
              style={{ ...iconBtn, color: index === total - 1 ? 'var(--gray-3)' : 'var(--gray-4)', cursor: index === total - 1 ? 'default' : 'pointer' }}
              onMouseEnter={e => { if (index < total - 1) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = index === total - 1 ? 'var(--gray-3)' : 'var(--gray-4)'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </>}
          {canDelete && (
            <button onClick={() => onDelete(stop.id)} title="Șterge oprire"
              style={{ ...iconBtn, color: 'var(--gray-4)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* date + time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Field label="Dată" value={stop.date} onChange={set('date')} placeholder="DD.MM.YYYY" />
        <Field label="Oră" value={stop.time} onChange={set('time')} placeholder="HH:MM / Direct" />
      </div>

      {isVama ? (
        <>
          <Field label="Punct vamal" value={stop.city} onChange={set('city')} placeholder="ex: GIURGIU - RUSE" />
          <Field label="Referință / Documente" value={stop.ref} onChange={set('ref')} />
        </>
      ) : (
        <>
          {/* Firmă + copy button */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ ...labelStyle, margin: 0 }}>Firmă</label>
              <button onClick={() => onCopyAddr(stop.id)} title="Copiază adresa pentru Maps"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 7px', border: `1px solid ${copiedId === stop.id ? 'var(--green)' : 'var(--gray-3)'}`, borderRadius: '5px', background: copiedId === stop.id ? 'var(--green)' : 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: 500, color: copiedId === stop.id ? 'white' : 'var(--gray-4)', fontFamily: FONT, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (copiedId !== stop.id) { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
                onMouseLeave={e => { if (copiedId !== stop.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; } }}>
                {copiedId === stop.id
                  ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat!</>
                  : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiază adresa</>
                }
              </button>
            </div>
            <input type="text" value={stop.company} onChange={e => set('company')(e.target.value)}
              placeholder={isInc ? 'ex: MUBEA PROSTEJOV' : 'ex: ILN MIOVENI'}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#ff7a3d'}
              onBlur={e  => e.target.style.borderColor = 'transparent'} />
          </div>
          <Field label="Stradă / Nr. / Zonă industrială" value={stop.street} onChange={set('street')} placeholder="ex: ROVNA 4708" />
          <Field label="Țară, Cod poștal, Oraș" value={stop.city} onChange={set('city')} placeholder={isInc ? 'ex: CZ 796 01 PROSTEJOV' : 'ex: RO 115400 MIOVENI'} />

          {/* Coords + save/cache buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Field label="Coordonate (Lat, Long)" value={stop.coords} onChange={set('coords')} placeholder="47.123456, 27.123456" />

            {/* Cache suggestion — show when no coords but cache hit */}
            {!stop.coords && cachedCoords && (
              <button onClick={handleApplyCache}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', border: '1px solid var(--green)', borderRadius: '7px', background: 'rgba(22,163,74,0.06)', cursor: 'pointer', fontSize: '12px', color: 'var(--green)', fontFamily: FONT, fontWeight: 500, transition: 'all 0.15s', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(22,163,74,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(22,163,74,0.06)'; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Coordonate salvate — aplică {cachedCoords}
              </button>
            )}

            {/* Save coords button — show when coords are filled */}
            {stop.coords && makeAddrKey(stop.street, stop.city) && (
              <button onClick={handleSaveCoords} disabled={savingCoords || coordsSaved}
                className={`fm-save${coordsSaved ? ' is-saved' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', border: `1px solid ${coordsSaved ? 'var(--fm-st-green)' : 'var(--gray-3)'}`, borderRadius: '8px', background: 'transparent', cursor: coordsSaved ? 'default' : 'pointer', fontSize: '12px', color: coordsSaved ? 'var(--fm-st-green)' : 'var(--gray-4)', fontFamily: FONT, fontWeight: coordsSaved ? 600 : 500, width: '100%' }}
                onMouseEnter={e => { if (!coordsSaved) { e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
                onMouseLeave={e => { if (!coordsSaved) { e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; } }}>
                <span className="fm-fill" aria-hidden="true" /><span className="fm-burst" aria-hidden="true" />
                <span className="fm-icon" aria-hidden="true">
                  <span className="fm-spark" style={{ '--a': '0deg' }} /><span className="fm-spark" style={{ '--a': '45deg' }} /><span className="fm-spark" style={{ '--a': '90deg' }} /><span className="fm-spark" style={{ '--a': '135deg' }} /><span className="fm-spark" style={{ '--a': '180deg' }} /><span className="fm-spark" style={{ '--a': '225deg' }} /><span className="fm-spark" style={{ '--a': '270deg' }} /><span className="fm-spark" style={{ '--a': '315deg' }} />
                  {coordsSaved
                    ? <svg className="fm-pop" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path className="fm-tick" d="M20 6L9 17l-5-5"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
                </span>
                <span>{coordsSaved ? 'Coordonate salvate' : savingCoords ? 'Se salvează…' : 'Salvează coordonatele'}</span>
              </button>
            )}
          </div>

          {isInc && <Field label="Detalii marfă / Tonaj" value={stop.details} onChange={set('details')} multiline />}
          <Field label="Referință" value={stop.ref} onChange={set('ref')} />
        </>
      )}
    </div>
  );
}

// ── Column header (linie colorată cu efect live) ─────────────
function ColHeader({ label, color, count, delay = '0s' }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '10px', marginBottom: '14px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '12px', color: 'var(--gray-4)', fontFamily: FONT }}>{count}</span>}
      <span className="fm-line" aria-hidden="true" style={{ color, '--d': delay }} />
    </div>
  );
}

// ── Flux de cifre (efect live discret în spatele documentului) ─
const HEX = '0123456789ABCDEF';
const randLine = () => Array.from({ length: 12 }, () => Array.from({ length: 4 }, () => HEX[Math.floor(Math.random() * 16)]).join('')).join(' ');
function HackStream() {
  const [lines, setLines] = useState(() => [0, 1, 2, 3].map(randLine));
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const iv = setInterval(() => {
      setLines(prev => prev.map(l => {
        const arr = l.split('');
        for (let k = 0; k < 6; k++) { const i = Math.floor(Math.random() * arr.length); if (arr[i] !== ' ') arr[i] = HEX[Math.floor(Math.random() * 16)]; }
        return arr.join('');
      }));
    }, 160);
    return () => clearInterval(iv);
  }, []);
  return <div className="fm-hack" aria-hidden="true">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
}

// ── Section heading ───────────────────────────────────────────
function SectionTitle({ num, title, extra, right }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--gray-4)', fontVariantNumeric: 'tabular-nums' }}>{num}</span>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--black)' }}>{title}</h3>
        {extra && <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}>{extra}</span>}
      </div>
      {right}
    </div>
  );
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px',
  border: '1px solid var(--gray-2)', borderRadius: '10px', background: 'transparent',
  cursor: 'pointer', fontSize: '13px', color: 'var(--black)', fontFamily: FONT,
};

// ── Main component ────────────────────────────────────────────
export default function GenerareComanda({ user }) {
  const [fields, setFields]         = useState(EMPTY_FIELDS);
  const [stops,  setStops]          = useState(DEFAULT_STOPS);
  const [loading, setLoading]       = useState(false);
  const [error,   setError]         = useState('');
  const [copied,  setCopied]        = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [hoverDrop, setHoverDrop]   = useState(false);
  const [fileName, setFileName]     = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(null);
  const fileRef = useRef();

  const setField = (key) => (val) => setFields(f => ({ ...f, [key]: val }));

  const updateStop = (id, key, val) =>
    setStops(prev => prev.map(s => s.id === id ? { ...s, [key]: val } : s));

  const moveStop = (type, index, dir) => setStops(prev => {
    const group  = prev.filter(s => s.type === type);
    const to = index + dir;
    if (to < 0 || to >= group.length) return prev;
    [group[index], group[to]] = [group[to], group[index]];
    let gi = 0;
    return prev.map(s => s.type === type ? group[gi++] : s);
  });

  const deleteStop     = (id) => setStops(prev => prev.filter(s => s.id !== id));
  const addStop        = (type) => setStops(prev => [...prev, newStop(type)]);
  const changeStopType = (id, newType) => setStops(prev => prev.map(s => s.id === id ? { ...s, type: newType } : s));
  const canDeleteStop  = (stop) => stops.filter(s => s.type === stop.type).length > 1;

  const copyAddr = (stopId) => {
    const s = stops.find(st => st.id === stopId);
    if (!s) return;
    const addr = [s.company, s.street, s.city].filter(Boolean).join(', ');
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      setCopiedAddr(stopId);
      setTimeout(() => setCopiedAddr(null), 2000);
    });
  };

  const processFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') { setError('Te rog selectează un fișier PDF valid.'); return; }
    setFileName(file.name); setError(''); setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      setPdfDataUrl(e.target.result);
      try {
        const base64 = e.target.result.split(',')[1];
        const token  = localStorage.getItem('authToken');
        const res = await fetch('/api/extract-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pdfBase64: base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Eroare server');
        const d = json.data;
        setFields({ order_number: d.order_number || '', client: d.client || '' });
        if (Array.isArray(d.stops) && d.stops.length > 0) {
          setStops(d.stops.map(s => ({ ...newStop(s.type || 'incarcare'), date: s.date||'', time: s.time||'', company: s.company||'', street: s.street||'', city: s.city||'', coords: s.coords||'', details: s.details||'', ref: s.ref||'' })));
        } else {
          setStops([
            { ...newStop('incarcare'),  date: d.load_date||'', time: d.load_time||'', company: d.load_company||'', street: d.load_street||'', city: d.load_city||'', details: d.load_details||'', ref: d.load_ref||'' },
            { ...newStop('descarcare'), date: d.unload_date||'', time: d.unload_time||'', company: d.unload_company||'', street: d.unload_street||'', city: d.unload_city||'', ref: d.unload_ref||'' },
          ]);
        }
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e) => { const f = e.target.files[0]; if (f) processFile(f); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildWhatsApp(fields, stops)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => { setFields(EMPTY_FIELDS); setStops(DEFAULT_STOPS()); setFileName(''); setError(''); setPdfDataUrl(''); setShowPdfModal(false); };

  const swapStops = () => setStops(prev => prev.map(s => {
    if (s.type === 'incarcare')  return { ...s, type: 'descarcare' };
    if (s.type === 'descarcare') return { ...s, type: 'incarcare' };
    return s;
  }));

  const incarcari  = stops.filter(s => s.type === 'incarcare');
  const descarcari = stops.filter(s => s.type === 'descarcare');
  const vami       = stops.filter(s => s.type === 'vama');
  const previewLines = buildWhatsApp(fields, stops).split('\n');

  return (
    <div style={{ paddingTop: '28px', fontFamily: FONT }}>

      {/* Modal PDF */}
      {showPdfModal && (
        <div onClick={() => setShowPdfModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '14px', overflow: 'hidden', width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', fontFamily: FONT }}>{fileName}</span>
              </div>
              <button onClick={() => setShowPdfModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '4px', display: 'flex', borderRadius: '6px', transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <iframe src={pdfDataUrl} style={{ flex: 1, border: 'none', width: '100%' }} title="PDF Preview" />
          </div>
        </div>
      )}

      {/* Titlu */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
        <div style={{ maxWidth: '620px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 300, color: 'var(--black)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15, fontFamily: FONT }}>Generare <strong style={{ fontWeight: 600 }}>comandă</strong></h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-4)', margin: '8px 0 0', lineHeight: 1.5, fontFamily: FONT }}>Încarcă PDF-ul comenzii de transport, AI-ul completează câmpurile, iar tu trimiți mesajul gata formatat pe WhatsApp.</p>
        </div>
        <button onClick={handleReset} style={{ ...ghostBtn, padding: '10px 16px', fontSize: '14px' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          Resetează
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'flex-start', maxWidth: '1340px' }}>
        <div style={{ flex: '1 1 600px', maxWidth: '820px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* 01 — Document */}
          <section style={{ paddingBottom: '24px', borderBottom: '1px solid var(--gray-2)' }}>
            <SectionTitle num="01" title="Document" />
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
            {loading ? (
              <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '28px 20px', border: '1px solid var(--gray-2)', borderRadius: '14px', background: 'var(--surface)', fontSize: '14px', color: 'var(--gray-4)' }}>
                <svg style={{ animation: 'spin-loader 0.8s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--fm-accent)" strokeWidth="2.4" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                AI procesează PDF-ul…
              </div>
            ) : fileName ? (
              <div style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px 16px', padding: '14px 16px', border: '1px solid var(--gray-2)', borderRadius: '14px', background: 'var(--surface)' }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
                <HackStream />
                <span style={{ width: '44px', height: '44px', flexShrink: 0, borderRadius: '10px', background: 'var(--gray-1)', color: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </span>
                <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                  {error
                    ? <span style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--fm-st-green)' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Extras automat · {stops.length} opriri</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {pdfDataUrl && (
                    <button onClick={() => setShowPdfModal(true)} style={ghostBtn}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                      Vezi PDF
                    </button>
                  )}
                  <button onClick={() => fileRef.current?.click()} style={ghostBtn}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Înlocuiește</button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                onMouseEnter={() => setHoverDrop(true)} onMouseLeave={() => setHoverDrop(false)}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '30px 20px', border: `1.5px dashed ${(dragOver || hoverDrop) ? 'var(--fm-accent)' : 'var(--gray-3)'}`, borderRadius: '14px', background: dragOver ? 'var(--fm-accent-soft)' : 'transparent', color: 'var(--gray-4)', cursor: 'pointer', fontFamily: FONT, transition: 'all 0.2s' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3-3 3 3"/></svg>
                <span style={{ fontSize: '14px', color: 'var(--black)' }}><span style={{ color: 'var(--fm-accent)', fontWeight: 600 }}>Alege un PDF</span> sau trage-l aici</span>
                <span style={{ fontSize: '12px' }}>Comanda de transport, un singur fișier PDF</span>
                {error && <span style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</span>}
              </button>
            )}
          </section>

          {/* 02 — Detalii comandă */}
          <section style={{ padding: '24px 0', borderBottom: '1px solid var(--gray-2)' }}>
            <SectionTitle num="02" title="Detalii comandă" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 16px' }}>
              <Field label="Număr comandă" value={fields.order_number} onChange={setField('order_number')} />
              <Field label="Client" value={fields.client} onChange={setField('client')} />
            </div>
          </section>

          {/* 03 — Traseu */}
          <section style={{ paddingTop: '24px' }}>
            <SectionTitle num="03" title="Traseu" extra={`${stops.length} opriri`} right={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {vami.length === 0 && (
                  <button onClick={() => addStop('vama')} style={ghostBtn}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Adaugă vamă
                  </button>
                )}
                <button onClick={swapStops} title="Inversează încărcare ↔ descărcare" style={ghostBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M16 3l4 4-4 4"/><path d="M20 17H4M8 13l-4 4 4 4"/></svg>
                  Inversează
                </button>
              </div>
            } />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 32px' }}>
              {[
                { type: 'incarcare',  label: 'Încărcare',  color: 'var(--green)',  list: incarcari,  add: 'Adaugă încărcare',  basis: '1 1 300px', delay: '0s' },
                { type: 'descarcare', label: 'Descărcare', color: 'var(--orange)', list: descarcari, add: 'Adaugă descărcare', basis: '1 1 300px', delay: '-1.2s' },
                ...(vami.length > 0 ? [{ type: 'vama', label: 'Vamă', color: 'var(--blue)', list: vami, add: 'Adaugă vamă', basis: '1 1 100%', delay: '-2.4s' }] : []),
              ].map(col => (
                <div key={col.type} style={{ flex: col.basis, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <ColHeader label={col.label} color={col.color} count={col.list.length} delay={col.delay} />
                  {col.list.map((stop, idx) => (
                    <div key={stop.id} style={idx > 0 ? { marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--gray-2)' } : undefined}>
                      {col.list.length > 1 && <div style={{ fontSize: '11px', color: col.color, fontWeight: 600, letterSpacing: '0.06em', marginBottom: '6px', fontFamily: FONT }}>#{idx + 1}</div>}
                      <StopBlock stop={stop} index={idx} total={col.list.length} onUpdate={updateStop} onMove={(i, dir) => moveStop(col.type, i, dir)} onDelete={deleteStop} canDelete={canDeleteStop(stop)} onChangeType={changeStopType} copiedId={copiedAddr} onCopyAddr={copyAddr} />
                    </div>
                  ))}
                  <button onClick={() => addStop(col.type)} style={{ ...ghostBtn, alignSelf: 'flex-start', marginTop: '12px', border: '1px dashed var(--gray-3)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    {col.add}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Previzualizare */}
        <aside style={{ flex: '1 1 360px', maxWidth: '480px', minWidth: 0, position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px 12px 20px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', fontFamily: FONT }}>Previzualizare mesaj</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-4)', fontFamily: FONT }}>Format WhatsApp</span>
              </div>
              <button onClick={handleCopy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', border: 'none', borderRadius: '10px', background: copied ? 'var(--fm-ok-bg)' : 'var(--black)', color: copied ? 'var(--fm-st-green)' : 'var(--bg-page)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: FONT, transition: 'all 0.15s' }}>
                {copied
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiază</>
                }
              </button>
            </div>
            <div style={{ padding: '18px 22px', minHeight: '220px', maxHeight: '70vh', overflowY: 'auto' }}>
              {previewLines.map((line, i) => {
                if (line === '') return <div key={i} style={{ height: '0.7em' }} />;
                const boldMatch = line.match(/^\*•(.*?)\*(.*)$/);
                if (boldMatch) {
                  const label = '•' + boldMatch[1], rest = boldMatch[2].trim();
                  return <div key={i} style={{ fontSize: '12.5px', color: 'var(--black)', fontFamily: "'SF Mono','Fira Code',monospace", lineHeight: 1.7 }}><strong style={{ fontWeight: 600 }}>{label}</strong>{rest ? ' ' + rest : ''}</div>;
                }
                return <div key={i} style={{ fontSize: '12.5px', color: 'var(--gray-4)', fontFamily: "'SF Mono','Fira Code',monospace", lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{line}</div>;
              })}
            </div>
          </div>

          <div style={{ padding: '4px 4px 0', fontFamily: FONT }}>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>Cum funcționează</span>
            <ol style={{ margin: '10px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', lineHeight: 1.5, color: 'var(--gray-4)' }}>
              <li>Încarcă PDF-ul comenzii de transport.</li>
              <li>AI-ul extrage automat toate opririle.</li>
              <li>Completează sau adaugă opriri din Traseu.</li>
              <li>Coordonatele se salvează per adresă, pentru data viitoare.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
