import { useState, useEffect, useRef } from 'react';

// ── Constante ─────────────────────────────────────────────────────────────────
const MONTHS_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const DOW_RO    = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'];

// ── DatePicker ─────────────────────────────────────────────────────────────────
// value/onChange folosesc formatul YYYY-MM-DD (compatibil cu HTML date inputs)
// Popover-ul e redat cu position:fixed → funcționează corect în interiorul modalelor
// compact=true → dimensiuni mici pentru bara de filtre (Dashboard)
// compact=false (default) → full-width pentru câmpuri din modale
export function DatePicker({ value, onChange, placeholder, required, compact = false }) {
  const [open, setOpen]           = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [viewYear, setViewYear]   = useState(null);
  const [viewMonth, setViewMonth] = useState(null);
  const [popPos, setPopPos]       = useState({ top: 0, left: 0 });

  const wrapRef    = useRef(null);
  const triggerRef = useRef(null);

  // Închide la click în afară
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Recalculează poziția la scroll/resize cât timp e deschis
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUp     = spaceBelow < 280;
        setPopPos({ top: openUp ? rect.top - 6 : rect.bottom + 6, left: rect.left, openUp });
      }
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

  const formatDisplay = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
  };

  const getDays = () => {
    if (viewYear === null) return [];
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOff = (firstDow + 6) % 7; // Luni = 0
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

  const handleOpen = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp     = spaceBelow < 280;
      setPopPos({ top: openUp ? rect.top - 6 : rect.bottom + 6, left: rect.left, openUp });
    }
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

  const days     = getDays();
  const isActive = open || hovered;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: compact ? 'inline-block' : 'block', width: compact ? 'auto' : '100%' }}>

      {/* ── Trigger ── */}
      <div ref={triggerRef} onClick={handleOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: compact ? '7px 10px' : '10px 12px',
          border: `1px solid ${isActive ? '#ff7a3d' : compact ? 'var(--gray-2)' : 'var(--gray-3)'}`,
          borderRadius: 8,
          fontSize: compact ? 13 : 14,
          background: compact ? 'var(--surface)' : 'var(--bg-page)',
          color: value ? 'var(--black)' : 'var(--gray-4)',
          cursor: 'pointer', userSelect: 'none',
          width: compact ? 'auto' : '100%',
          minWidth: compact ? 120 : undefined,
          boxSizing: 'border-box',
          justifyContent: 'space-between',
          transition: 'border-color 0.15s',
          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={isActive ? '#ff7a3d' : 'currentColor'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize: compact ? 13 : 14 }}>
            {value ? formatDisplay(value) : (placeholder || 'Selectează data')}
          </span>
        </div>
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange(''); }}
            style={{ fontSize: 17, lineHeight: 1, color: 'var(--gray-4)', fontWeight: 300, flexShrink: 0 }}>×</span>
        )}
      </div>

      {/* ── Popover (position: fixed → nu e cioplit de overflow modal) ── */}
      {open && viewYear !== null && (
        <div style={{
          position: 'fixed',
          top:  popPos.openUp ? undefined  : popPos.top,
          bottom: popPos.openUp ? window.innerHeight - popPos.top : undefined,
          left: popPos.left,
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
