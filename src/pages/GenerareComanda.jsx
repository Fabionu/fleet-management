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
  padding: '10px 12px', fontSize: '14px',
  border: '1px solid var(--gray-2)', borderRadius: '8px',
  background: 'var(--gray-1)', color: 'var(--black)',
  outline: 'none', fontFamily: FONT, transition: 'border-color 0.15s',
};
const labelStyle = {
  fontSize: '11px', fontWeight: 600, color: 'var(--gray-4)',
  textTransform: 'uppercase', letterSpacing: '0.07em',
  marginBottom: '6px', display: 'block', fontFamily: FONT,
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
          onBlur={e  => e.target.style.borderColor = 'var(--gray-2)'} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''} style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e  => e.target.style.borderColor = 'var(--gray-2)'} />
      )}
    </div>
  );
}

// ── Add stop dropdown button ──────────────────────────────────
function AddStopDropdown({ onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const opts = [
    { type: 'incarcare',  label: 'Încărcare',  color: 'var(--green)',  dot: '#16a34a' },
    { type: 'descarcare', label: 'Descărcare', color: 'var(--orange)', dot: '#ea580c' },
    { type: 'vama',       label: 'Vamă',       color: 'var(--blue)',   dot: '#2563eb' },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--gray-4)', fontFamily: FONT, transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Adaugă oprire
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
          background: 'var(--surface)', border: '1px solid var(--gray-2)',
          borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          overflow: 'hidden', zIndex: 100, minWidth: 160,
        }}>
          {opts.map(opt => (
            <button
              key={opt.type}
              onClick={() => { onAdd(opt.type); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--black)', fontFamily: FONT, textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />
              {opt.label}
            </button>
          ))}
        </div>
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
      setTimeout(() => setCoordsSaved(false), 2500);
    } finally { setSavingCoords(false); }
  };

  const handleApplyCache = () => {
    if (cachedCoords) { onUpdate(stop.id, 'coords', cachedCoords); setCachedCoords(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
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
              onBlur={e  => e.target.style.borderColor = 'var(--gray-2)'} />
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
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', border: `1px solid ${coordsSaved ? 'var(--green)' : 'var(--gray-3)'}`, borderRadius: '7px', background: coordsSaved ? 'rgba(22,163,74,0.06)' : 'transparent', cursor: coordsSaved ? 'default' : 'pointer', fontSize: '12px', color: coordsSaved ? 'var(--green)' : 'var(--gray-4)', fontFamily: FONT, fontWeight: 500, transition: 'all 0.15s', width: '100%' }}
                onMouseEnter={e => { if (!coordsSaved) { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
                onMouseLeave={e => { if (!coordsSaved) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; } }}>
                {coordsSaved ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Coordonate salvate</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvează coordonatele</>
                )}
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

// ── Column header ─────────────────────────────────────────────
function ColHeader({ label, color }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function GenerareComanda({ user }) {
  const [fields, setFields]         = useState(EMPTY_FIELDS);
  const [stops,  setStops]          = useState(DEFAULT_STOPS);
  const [loading, setLoading]       = useState(false);
  const [error,   setError]         = useState('');
  const [copied,  setCopied]        = useState(false);
  const [dragOver, setDragOver]     = useState(false);
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

      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--black)', margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>Generare Comandă</h2>
        <p style={{ fontSize: '13px', color: 'var(--gray-4)', marginTop: '5px', fontFamily: FONT }}>Încarcă un PDF cu comanda de transport și AI-ul va completa automat câmpurile.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Drop zone */}
          <div onClick={() => !loading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            style={{ border: dragOver ? '2px dashed #ff7a3d' : '2px dashed var(--gray-3)', borderRadius: '12px', padding: '28px 20px', textAlign: 'center', cursor: loading ? 'default' : 'pointer', background: dragOver ? 'rgba(255,122,61,0.04)' : 'var(--gray-1)', transition: 'all 0.15s' }}>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <svg style={{ animation: 'spin-loader 0.8s linear infinite' }} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}>AI procesează PDF-ul...</span>
              </div>
            ) : fileName ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
                <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>{fileName}</span>
                <span style={{ fontSize: '11px', color: 'var(--gray-4)' }}>Click pentru a înlocui</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}><span style={{ color: '#ff7a3d', fontWeight: 600 }}>Click</span> sau trage un PDF aici</span>
              </div>
            )}
          </div>

          {pdfDataUrl && !loading && (
            <button onClick={() => setShowPdfModal(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%', padding: '9px 14px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--black)', fontFamily: FONT, fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M2 12s3-5 10-5 10 5 10 5-3 5-10 5-10-5-10-5z"/></svg>
              Previzualizează PDF original
            </button>
          )}

          {error && <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: '8px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          {/* Fields card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '14px', padding: '24px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Număr comandă" value={fields.order_number} onChange={setField('order_number')} />
              <Field label="Client" value={fields.client} onChange={setField('client')} />
            </div>

            {/* 2 columns: Încărcare | Descărcare */}
            <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: '20px' }}>
              {/* Headers + swap button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}><ColHeader label="Încărcare" color="var(--green)" /></div>
                <button
                  onClick={swapStops}
                  title="Inversează încărcare ↔ descărcare"
                  style={{ flexShrink: 0, width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px', cursor: 'pointer', color: 'var(--gray-4)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; e.currentTarget.style.color = 'var(--black)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--gray-4)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
                    <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                </button>
                <div style={{ flex: 1 }}><ColHeader label="Descărcare" color="var(--orange)" /></div>
              </div>

              {/* Stop columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {incarcari.map((stop, idx) => (
                    <div key={stop.id}>
                      {incarcari.length > 1 && <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '10px', fontFamily: FONT }}>#{idx + 1}</div>}
                      <StopBlock stop={stop} index={idx} total={incarcari.length} onUpdate={updateStop} onMove={(i, dir) => moveStop('incarcare', i, dir)} onDelete={deleteStop} canDelete={canDeleteStop(stop)} onChangeType={changeStopType} copiedId={copiedAddr} onCopyAddr={copyAddr} />
                      {idx < incarcari.length - 1 && <div style={{ marginTop: '20px', borderBottom: '1px dashed var(--gray-2)' }} />}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {descarcari.map((stop, idx) => (
                    <div key={stop.id}>
                      {descarcari.length > 1 && <div style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '10px', fontFamily: FONT }}>#{idx + 1}</div>}
                      <StopBlock stop={stop} index={idx} total={descarcari.length} onUpdate={updateStop} onMove={(i, dir) => moveStop('descarcare', i, dir)} onDelete={deleteStop} canDelete={canDeleteStop(stop)} onChangeType={changeStopType} copiedId={copiedAddr} onCopyAddr={copyAddr} />
                      {idx < descarcari.length - 1 && <div style={{ marginTop: '20px', borderBottom: '1px dashed var(--gray-2)' }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Vamă — full width, only if exists */}
            {vami.length > 0 && (
              <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>Vamă</span>
                <div style={{ display: 'grid', gridTemplateColumns: vami.length > 1 ? '1fr 1fr' : '1fr', gap: '12px 24px' }}>
                  {vami.map((stop, idx) => (
                    <div key={stop.id}>
                      {vami.length > 1 && <div style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '10px', fontFamily: FONT }}>#{idx + 1}</div>}
                      <StopBlock stop={stop} index={idx} total={vami.length} onUpdate={updateStop} onMove={(i, dir) => moveStop('vama', i, dir)} onDelete={deleteStop} canDelete={canDeleteStop(stop)} onChangeType={changeStopType} copiedId={copiedAddr} onCopyAddr={copyAddr} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom row: add + reset */}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--gray-2)' }}>
              <AddStopDropdown onAdd={addStop} />
              <button onClick={handleReset}
                style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--gray-4)', fontFamily: FONT, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                Resetează
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', fontFamily: FONT }}>Preview comandă</span>
              <button onClick={handleCopy}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', border: '1px solid var(--gray-3)', borderRadius: '7px', background: copied ? 'var(--green)' : 'transparent', cursor: 'pointer', fontSize: '13px', color: copied ? 'white' : 'var(--black)', fontFamily: FONT, transition: 'all 0.15s', fontWeight: 500 }}
                onMouseEnter={e => { if (!copied) { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
                onMouseLeave={e => { if (!copied) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; } }}>
                {copied
                  ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat!</>
                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Copiază</>
                }
              </button>
            </div>
            <div style={{ padding: '20px 24px', background: 'var(--surface)', minHeight: '220px', maxHeight: '70vh', overflowY: 'auto' }}>
              {previewLines.map((line, i) => {
                if (line === '') return <div key={i} style={{ height: '0.8em' }} />;
                const boldMatch = line.match(/^\*•(.*?)\*(.*)$/);
                if (boldMatch) {
                  const label = '•' + boldMatch[1], rest = boldMatch[2].trim();
                  return <div key={i} style={{ fontSize: '13px', color: 'var(--black)', fontFamily: "'SF Mono','Fira Code',monospace", lineHeight: 1.7 }}><strong>{label}</strong>{rest ? ' ' + rest : ''}</div>;
                }
                return <div key={i} style={{ fontSize: '13px', color: 'var(--gray-4)', fontFamily: "'SF Mono','Fira Code',monospace", lineHeight: 1.7 }}>{line}</div>;
              })}
            </div>
          </div>

          <div style={{ padding: '14px 18px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '12px', fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.7, fontFamily: FONT }}>
            <strong style={{ color: 'var(--black)', fontWeight: 600 }}>Cum funcționează:</strong><br/>
            1. Încarcă PDF-ul comenzii de transport<br/>
            2. AI-ul extrage automat toate opririle<br/>
            3. Adaugă opriri cu butonul <em>Adaugă oprire</em><br/>
            4. Coordonatele se salvează automat per adresă
          </div>
        </div>
      </div>
    </div>
  );
}
