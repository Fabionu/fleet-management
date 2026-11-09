import { useState, useEffect } from 'react';

// Normalize address key for cache lookup
export const makeAddrKey = (street, city) =>
  [street, city].filter(Boolean).map(s => s.trim().toLowerCase()).join('|');

// Coordinate cache for one stop: lookup by address, apply a cached hit, save new coords
export function useCoordsCache(stop, onUpdate) {
  const isVama = stop.type === 'vama';
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

  return { cachedCoords, coordsSaved, savingCoords, handleSaveCoords, handleApplyCache };
}

// WhatsApp "sent" bubble — bold only on *…* labels, timestamp + read ticks inline
export function WhatsAppBubble({ lines }) {
  return (
    <div style={{ position: 'relative', maxWidth: '92%', boxSizing: 'border-box', padding: '6px 7px 8px 9px', background: 'var(--fm-wa-bubble)', color: 'var(--fm-wa-text)', borderRadius: '7.5px 0 7.5px 7.5px', boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)', fontFamily: "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '14.2px', lineHeight: '19px' }}>
      <span aria-hidden="true" style={{ position: 'absolute', top: 0, right: '-8px', width: '8px', height: '13px', background: 'var(--fm-wa-bubble)', clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        if (line === '') return <div key={i} style={{ height: '19px' }} />;
        const boldMatch = line.match(/^\*•(.*?)\*(.*)$/);
        const body = boldMatch
          ? <><strong style={{ fontWeight: 700 }}>{'•' + boldMatch[1]}</strong>{boldMatch[2].trim() ? ' ' + boldMatch[2].trim() : ''}</>
          : line;
        return (
          <div key={i}>
            {body}
            {isLast && <span aria-hidden="true" style={{ display: 'inline-block', width: '66px' }} />}
          </div>
        );
      })}
      <div style={{ position: 'absolute', right: '7px', bottom: '3px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', lineHeight: '15px', color: 'var(--fm-wa-meta)' }}>
        <span>{new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
        <svg aria-hidden="true" width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5.5l3.2 3.2L10.5 1.5"/><path d="M6 8.2l.5.5L12.8 1.5"/></svg>
      </div>
    </div>
  );
}

// Rând „Design Apple” din meniul contului: comutator iOS (în stilul clasic sau Apple al meniului)
export function DesignToggleRow({ on, onToggle, apple }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={onToggle}
      className={`ap-tg-row${apple ? ' ap-menu-item' : ''}`}
      style={apple ? undefined : { width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
      onMouseEnter={apple ? undefined : e => { e.currentTarget.style.background = 'var(--gray-1)'; }}
      onMouseLeave={apple ? undefined : e => { e.currentTarget.style.background = 'transparent'; }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={apple ? 1.8 : 2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/></svg>
      <span style={{ flex: 1 }}>Design Apple</span>
      <span className={`ap-tg-track${on ? ' is-on' : ''}`} aria-hidden="true">
        <span className="ap-tg-knob" style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
      </span>
    </button>
  );
}
