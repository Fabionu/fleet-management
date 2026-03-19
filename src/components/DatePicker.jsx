import { useState, useEffect, useRef } from 'react';

const MONTHS_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const DOW_RO    = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'];

// ── DatePicker ─────────────────────────────────────────────────────────────────
// Design: input text cu iconița calendar în dreapta
//   - input permite introducere manuală în format ZZ.LL.AAAA
//   - click pe iconița calendar → deschide popover custom
//   - value/onChange → format intern YYYY-MM-DD (compatibil cu logica existentă)
//   - compact=true → stiluri mici pentru bara de filtre (Dashboard)
export function DatePicker({ value, onChange, placeholder, required, compact = false }) {
  const [open, setOpen]           = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [focused, setFocused]     = useState(false);
  const [inputText, setInputText] = useState('');
  const [viewYear, setViewYear]   = useState(null);
  const [viewMonth, setViewMonth] = useState(null);
  const [popPos, setPopPos]       = useState({ top: 0, left: 0, openUp: false });

  const wrapRef    = useRef(null);
  const containerRef = useRef(null); // containerul vizibil (input + icon)

  // ── Sincronizare inputText ← value (YYYY-MM-DD → ZZ.LL.AAAA) ──────────────
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      setInputText(`${d}.${m}.${y}`);
    } else {
      setInputText('');
    }
  }, [value]);

  // ── Închide la click în afară ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Poziție popover (recalculat la scroll/resize) ─────────────────────────
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp     = spaceBelow < 290;
      setPopPos({ top: rect.bottom + 4, left: rect.left, openUp, triggerTop: rect.top - 4 });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Tastare manuală cu auto-formatare DD.MM.YYYY ─────────────────────────
  const handleInputChange = (e) => {
    const raw    = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 8); // doar cifre, max 8

    // Reconstruiește cu puncte automat
    let formatted = digits;
    if (digits.length > 4) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4);
    } else if (digits.length > 2) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    }

    setInputText(formatted);

    // Parsează și trimite valoarea YYYY-MM-DD doar când data e completă (8 cifre)
    if (digits.length === 8) {
      const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8);
      onChange(`${y}-${m}-${d}`);
    } else if (!digits.length) {
      onChange('');
    }
  };

  // ── Deschide calendarul ───────────────────────────────────────────────────
  const handleCalendarOpen = (e) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp     = spaceBelow < 290;
      setPopPos({ top: rect.bottom + 4, left: rect.left, openUp, triggerTop: rect.top - 4 });
    }
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(o => !o);
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const getDays = () => {
    if (viewYear === null) return [];
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOff = (firstDow + 6) % 7;
    const days = [];
    for (let i = startOff - 1; i >= 0; i--)
      days.push({ date: new Date(viewYear, viewMonth, -i),    cur: false });
    for (let d = 1; d <= lastDate; d++)
      days.push({ date: new Date(viewYear, viewMonth, d),      cur: true  });
    const rem = 42 - days.length;
    for (let d = 1; d <= rem; d++)
      days.push({ date: new Date(viewYear, viewMonth + 1, d),  cur: false });
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

  const days     = getDays();
  const isActive = open || hovered || focused;

  // ── Stiluri ───────────────────────────────────────────────────────────────
  const padding   = compact ? '7px 0px 7px 10px' : '10px 0px 10px 12px';
  const fontSize  = compact ? 13 : 14;
  const bg        = compact ? 'var(--surface)' : 'var(--bg-page)';
  const borderClr = isActive ? '#ff7a3d' : compact ? 'var(--gray-2)' : 'var(--gray-3)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: compact ? 'inline-flex' : 'block', width: compact ? 'auto' : '100%' }}>

      {/* ── Input + iconița calendar ── */}
      <div ref={containerRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center',
          border: `1px solid ${borderClr}`,
          borderRadius: 8, background: bg,
          transition: 'border-color 0.15s',
          width: compact ? 'auto' : '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>

        {/* Input text */}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || 'ZZ.LL.AAAA'}
          required={required}
          style={{
            flex: 1,
            border: 'none', outline: 'none',
            padding,
            fontSize,
            background: 'transparent',
            color: 'var(--black)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            minWidth: compact ? 95 : 0,
            width: compact ? 'auto' : '100%',
          }}
        />

        {/* Separator */}
        {!compact && value && (
          <span onClick={() => onChange('')}
            style={{ fontSize: 17, lineHeight: 1, color: 'var(--gray-4)', fontWeight: 300, cursor: 'pointer', paddingRight: 4, flexShrink: 0 }}>×</span>
        )}

        {/* Buton calendar */}
        <button
          type="button"
          onClick={handleCalendarOpen}
          title="Deschide calendarul"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: compact ? '0 8px 0 4px' : '0 10px 0 6px',
            display: 'flex', alignItems: 'center',
            color: isActive ? '#ff7a3d' : 'var(--gray-4)',
            transition: 'color 0.15s',
            flexShrink: 0,
            height: '100%',
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </button>
      </div>

      {/* ── Popover calendar (position:fixed → nu e cioplit de modal) ── */}
      {open && viewYear !== null && (
        <div style={{
          position: 'fixed',
          top:    popPos.openUp ? undefined  : popPos.top,
          bottom: popPos.openUp ? `${window.innerHeight - popPos.triggerTop}px` : undefined,
          left:   popPos.left,
          zIndex: 9999,
          background: 'var(--surface)',
          border: '1px solid var(--gray-2)',
          borderRadius: 12,
          padding: '14px 14px 10px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
          width: 252,
        }}>

          {/* Header navigare lună */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '3px 7px', borderRadius: 6, fontSize: 17, lineHeight: 1, fontFamily: 'inherit' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>
              {MONTHS_RO[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '3px 7px', borderRadius: 6, fontSize: 17, lineHeight: 1, fontFamily: 'inherit' }}>›</button>
          </div>

          {/* Zile săptămână */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DOW_RO.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', letterSpacing: '0.03em', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Grid zile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {days.map(({ date, cur }, i) => {
              const str        = date.toISOString().split('T')[0];
              const isSelected = str === value;
              const isToday    = str === todayStr;
              return (
                <button key={i} onClick={() => handleDay(date)}
                  style={{
                    padding: '5px 0', textAlign: 'center', fontSize: 12, lineHeight: 1,
                    fontFamily: 'inherit', fontWeight: isToday ? 700 : 400,
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

          {/* Footer Azi */}
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

export default DatePicker;
