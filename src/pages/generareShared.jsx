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

// iOS-style switch to toggle between the classic and the Apple design
export function DesignSwitch({ on, onToggle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <span id="design-switch-label" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--black)' }}>Design Apple</span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby="design-switch-label" onClick={onToggle} className="ap-switch"
        style={{ position: 'relative', flex: '0 0 51px', width: '51px', height: '31px', padding: 0, border: 'none', borderRadius: '999px', background: on ? 'var(--ap-switch-on)' : 'var(--ap-switch-off)', cursor: 'pointer' }}>
        <span aria-hidden="true" className="ap-switch-knob" style={{ position: 'absolute', top: '2px', left: '2px', width: '27px', height: '27px', borderRadius: '50%', background: 'var(--ap-knob)', boxShadow: '0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16)', transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}
