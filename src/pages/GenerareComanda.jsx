import { useState, useRef, useCallback } from 'react';

const FONT = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

let _uid = 0;
const uid = () => ++_uid;

const newStop = (type) => ({
  id: uid(),
  type, // 'incarcare' | 'descarcare'
  date: '', time: '',
  company: '', street: '', city: '',
  coords: '',
  details: '',
  ref: '',
});

const EMPTY_FIELDS = { order_number: '', client: '' };
const DEFAULT_STOPS = () => [newStop('incarcare'), newStop('descarcare')];

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
  const latAbs = latStr.startsWith('-') ? latStr.slice(1) : latStr;
  const lngAbs = lngStr.startsWith('-') ? lngStr.slice(1) : lngStr;
  return `${latDir} - ${lngDir} ${latAbs}, ${lngAbs}`;
}

function buildWhatsApp(fields, stops) {
  const lines = [
    `*•NUMĂR COMANDĂ:* ${fields.order_number || '___________'}`,
    `*•NUME CLIENT:* ${fields.client || '___________'}`,
    ``,
  ];

  const multiInc  = stops.filter(s => s.type === 'incarcare').length  > 1;
  const multiDesc = stops.filter(s => s.type === 'descarcare').length > 1;
  let iInc = 0, iDesc = 0;

  for (const stop of stops) {
    const isInc = stop.type === 'incarcare';
    if (isInc) iInc++; else iDesc++;
    const label      = isInc ? 'ÎNCĂRCARE'  : 'DESCĂRCARE';
    const coordLabel = isInc ? 'INCARCARE'  : 'DESCARCARE';
    const suffix     = (isInc ? multiInc : multiDesc) ? ` ${isInc ? iInc : iDesc}` : '';
    const addr = [stop.company, stop.street, stop.city].filter(Boolean).join('\n') || '___________';

    lines.push(`*•${label}${suffix} ${stop.date || '___'}, ${fmtTime(stop.time)}, LA ADRESA:*`);
    lines.push(``);
    lines.push(addr);
    lines.push(``);
    lines.push(`*•COORDONATE ${coordLabel}${suffix}:*`);
    lines.push(fmtCoord(stop.coords));
    if (isInc) {
      lines.push(``);
      lines.push(`*•DETALII INCARCARE:*${stop.details ? ' ' + stop.details : ''}`);
    }
    if (stop.ref) lines.push(`*•REFERINTA:* ${stop.ref}`);
    lines.push(``);
  }

  return lines.join('\n');
}

// ── Styles ────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 11px', fontSize: '13px',
  border: '1px solid var(--gray-2)', borderRadius: '7px',
  background: 'var(--gray-1)', color: 'var(--black)',
  outline: 'none', fontFamily: FONT, transition: 'border-color 0.15s',
};

const labelStyle = {
  fontSize: '11px', fontWeight: 600,
  color: 'var(--gray-4)', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: '5px', display: 'block',
  fontFamily: FONT,
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

// ── Icon buttons shared style ─────────────────────────────────
const iconBtn = {
  background: 'transparent', border: 'none',
  cursor: 'pointer', padding: '4px 5px',
  borderRadius: '5px', display: 'flex', alignItems: 'center',
  transition: 'background 0.12s, color 0.12s',
};

// ── StopCard ──────────────────────────────────────────────────
function StopCard({ stop, index, total, onUpdate, onMove, onDelete, canDelete, copiedId, onCopyAddr }) {
  const isInc = stop.type === 'incarcare';
  const accent = isInc ? 'var(--green)' : 'var(--orange)';
  const set = (key) => (val) => onUpdate(stop.id, key, val);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--gray-2)',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '9px 12px',
        background: 'var(--gray-1)',
        borderBottom: '1px solid var(--gray-2)',
      }}>
        {/* type dot */}
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />

        {/* label */}
        <span style={{ fontSize: '11px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT, flex: 1 }}>
          {isInc ? 'Încărcare' : 'Descărcare'}
        </span>

        {/* copy address */}
        <button
          onClick={() => onCopyAddr(stop.id)}
          title="Copiază adresa"
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px',
            border: `1px solid ${copiedId === stop.id ? 'var(--green)' : 'var(--gray-3)'}`,
            borderRadius: '5px',
            background: copiedId === stop.id ? 'var(--green)' : 'transparent',
            cursor: 'pointer', fontSize: '11px', fontWeight: 500,
            color: copiedId === stop.id ? 'white' : 'var(--gray-4)',
            fontFamily: FONT, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (copiedId !== stop.id) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; } }}
          onMouseLeave={e => { if (copiedId !== stop.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; } }}
        >
          {copiedId === stop.id ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Copiat
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Adresă
            </>
          )}
        </button>

        {/* separator */}
        <div style={{ width: 1, height: 14, background: 'var(--gray-3)', margin: '0 2px' }} />

        {/* move up */}
        <button
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          title="Mută sus"
          style={{ ...iconBtn, color: index === 0 ? 'var(--gray-3)' : 'var(--gray-4)', cursor: index === 0 ? 'default' : 'pointer' }}
          onMouseEnter={e => { if (index > 0) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = index === 0 ? 'var(--gray-3)' : 'var(--gray-4)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>

        {/* move down */}
        <button
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          title="Mută jos"
          style={{ ...iconBtn, color: index === total - 1 ? 'var(--gray-3)' : 'var(--gray-4)', cursor: index === total - 1 ? 'default' : 'pointer' }}
          onMouseEnter={e => { if (index < total - 1) { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = index === total - 1 ? 'var(--gray-3)' : 'var(--gray-4)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        {/* delete */}
        {canDelete && (
          <button
            onClick={() => onDelete(stop.id)}
            title="Șterge oprire"
            style={{ ...iconBtn, color: 'var(--gray-4)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* ── Fields ── */}
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="Dată" value={stop.date} onChange={set('date')} placeholder="DD.MM.YYYY" />
          <Field label="Oră" value={stop.time} onChange={set('time')} placeholder="HH:MM / Direct" />
        </div>
        <Field label="Firmă" value={stop.company} onChange={set('company')} placeholder={isInc ? 'ex: MUBEA PROSTEJOV' : 'ex: ILN MIOVENI'} />
        <Field label="Stradă / Nr. / Zonă industrială" value={stop.street} onChange={set('street')} placeholder="ex: ROVNA 4708" />
        <Field label="Țară, Cod poștal, Oraș" value={stop.city} onChange={set('city')} placeholder={isInc ? 'ex: CZ 796 01 PROSTEJOV' : 'ex: RO 115400 MIOVENI'} />
        <Field label="Coordonate (Lat, Long)" value={stop.coords} onChange={set('coords')} placeholder="47.123456, 27.123456" />
        {isInc && <Field label="Detalii marfă / Tonaj" value={stop.details} onChange={set('details')} multiline />}
        <Field label="Referință" value={stop.ref} onChange={set('ref')} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function GenerareComanda({ user }) {
  const [fields, setFields]       = useState(EMPTY_FIELDS);
  const [stops, setStops]         = useState(DEFAULT_STOPS);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [fileName, setFileName]   = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(null);
  const fileRef = useRef();

  const setField = (key) => (val) => setFields(f => ({ ...f, [key]: val }));

  // ── Stop handlers ─────────────────────────────────────────
  const updateStop = (id, key, val) =>
    setStops(prev => prev.map(s => s.id === id ? { ...s, [key]: val } : s));

  const moveStop = (index, dir) => setStops(prev => {
    const arr = [...prev];
    const to = index + dir;
    if (to < 0 || to >= arr.length) return prev;
    [arr[index], arr[to]] = [arr[to], arr[index]];
    return arr;
  });

  const deleteStop = (id) => setStops(prev => prev.filter(s => s.id !== id));

  const addStop = (type) => setStops(prev => [...prev, newStop(type)]);

  const canDeleteStop = (stop) => stops.filter(s => s.type === stop.type).length > 1;

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

  // ── PDF processing ────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Te rog selectează un fișier PDF valid.');
      return;
    }
    setFileName(file.name);
    setError('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      setPdfDataUrl(e.target.result);
      try {
        const base64 = e.target.result.split(',')[1];
        const token = localStorage.getItem('authToken');
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
          setStops(d.stops.map(s => ({
            ...newStop(s.type || 'incarcare'),
            date: s.date || '', time: s.time || '',
            company: s.company || '', street: s.street || '', city: s.city || '',
            coords: s.coords || '', details: s.details || '', ref: s.ref || '',
          })));
        } else {
          // fallback format vechi (load_* / unload_*)
          setStops([
            { ...newStop('incarcare'), date: d.load_date||'', time: d.load_time||'', company: d.load_company||'', street: d.load_street||'', city: d.load_city||'', details: d.load_details||'', ref: d.load_ref||'' },
            { ...newStop('descarcare'), date: d.unload_date||'', time: d.unload_time||'', company: d.unload_company||'', street: d.unload_street||'', city: d.unload_city||'', ref: d.unload_ref||'' },
          ]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e) => { const f = e.target.files[0]; if (f) processFile(f); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildWhatsApp(fields, stops)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setFields(EMPTY_FIELDS);
    setStops(DEFAULT_STOPS());
    setFileName('');
    setError('');
    setPdfDataUrl('');
    setShowPdfModal(false);
  };

  const previewLines = buildWhatsApp(fields, stops).split('\n');

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: '28px', fontFamily: FONT }}>

      {/* Modal PDF preview */}
      {showPdfModal && (
        <div onClick={() => setShowPdfModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '14px', overflow: 'hidden', width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', fontFamily: FONT }}>{fileName}</span>
              </div>
              <button onClick={() => setShowPdfModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <iframe src={pdfDataUrl} style={{ flex: 1, border: 'none', width: '100%' }} title="PDF Preview" />
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--black)', margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>
          Generare Comandă
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--gray-4)', marginTop: '5px', fontFamily: FONT }}>
          Încarcă un PDF cu comanda de transport și AI-ul va completa automat câmpurile.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', alignItems: 'start' }}>

        {/* LEFT — Upload + Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Drop zone */}
          <div
            onClick={() => !loading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: dragOver ? '2px dashed #ff7a3d' : '2px dashed var(--gray-3)',
              borderRadius: '12px', padding: '28px 20px',
              textAlign: 'center', cursor: loading ? 'default' : 'pointer',
              background: dragOver ? 'rgba(255,122,61,0.04)' : 'var(--gray-1)',
              transition: 'all 0.15s',
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <svg style={{ animation: 'spin-loader 0.8s linear infinite' }} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}>AI procesează PDF-ul...</span>
              </div>
            ) : fileName ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <polyline points="9 15 11 17 15 13"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>{fileName}</span>
                <span style={{ fontSize: '11px', color: 'var(--gray-4)' }}>Click pentru a înlocui</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9"  y1="15" x2="15" y2="15"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}>
                  <span style={{ color: '#ff7a3d', fontWeight: 600 }}>Click</span> sau trage un PDF aici
                </span>
              </div>
            )}
          </div>

          {/* Buton preview PDF */}
          {pdfDataUrl && !loading && (
            <button onClick={() => setShowPdfModal(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%', padding: '9px 14px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--black)', fontFamily: FONT, fontWeight: 500, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--gray-4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/>
                <path d="M2 12s3-5 10-5 10 5 10 5-3 5-10 5-10-5-10-5z"/>
              </svg>
              Previzualizează PDF original
            </button>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: '8px', fontSize: '13px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {/* ── Fields card ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '14px', padding: '24px' }}>

            {/* Număr comandă + Client */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Număr comandă" value={fields.order_number} onChange={setField('order_number')} />
              <Field label="Client" value={fields.client} onChange={setField('client')} />
            </div>

            {/* ── Stops list ── */}
            <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stops.map((stop, index) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  index={index}
                  total={stops.length}
                  onUpdate={updateStop}
                  onMove={moveStop}
                  onDelete={deleteStop}
                  canDelete={canDeleteStop(stop)}
                  copiedId={copiedAddr}
                  onCopyAddr={copyAddr}
                />
              ))}

              {/* ── Add stop buttons ── */}
              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button
                  onClick={() => addStop('incarcare')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '7px',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '12px', fontWeight: 500,
                    color: 'var(--gray-4)',
                    fontFamily: FONT,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.background = 'rgba(22,163,74,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-3)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Încărcare
                </button>

                <button
                  onClick={() => addStop('descarcare')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '7px',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '12px', fontWeight: 500,
                    color: 'var(--gray-4)',
                    fontFamily: FONT,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)'; e.currentTarget.style.background = 'rgba(234,88,12,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-3)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Descărcare
                </button>
              </div>
            </div>

            {/* Reset */}
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--gray-2)' }}>
              <button onClick={handleReset}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--gray-4)', fontFamily: FONT, transition: 'all 0.15s' }}
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
                {copied ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat!</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Copiază</>
                )}
              </button>
            </div>

            {/* Preview text */}
            <div style={{ padding: '20px 24px', background: 'var(--surface)', minHeight: '220px', maxHeight: '70vh', overflowY: 'auto' }}>
              {previewLines.map((line, i) => {
                if (line === '') return <div key={i} style={{ height: '0.7em' }} />;
                const boldMatch = line.match(/^\*•(.*?)\*(.*)$/);
                if (boldMatch) {
                  const label = '•' + boldMatch[1];
                  const rest  = boldMatch[2].trim();
                  return (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--black)', fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.7 }}>
                      <strong>{label}</strong>{rest ? ' ' + rest : ''}
                    </div>
                  );
                }
                return <div key={i} style={{ fontSize: '13px', color: 'var(--gray-4)', fontFamily: "'SF Mono', 'Fira Code', monospace", lineHeight: 1.7 }}>{line}</div>;
              })}
            </div>
          </div>

          <div style={{ padding: '14px 18px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '12px', fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.7, fontFamily: FONT }}>
            <strong style={{ color: 'var(--black)', fontWeight: 600 }}>Cum funcționează:</strong><br/>
            1. Încarcă PDF-ul comenzii de transport<br/>
            2. AI-ul extrage automat toate opririle<br/>
            3. Adaugă opriri suplimentare dacă e necesar<br/>
            4. Copiază textul formatat pentru WhatsApp
          </div>
        </div>
      </div>
    </div>
  );
}
