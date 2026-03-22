import { useState } from 'react';

function WeekendHistoryModal({ truck, onClose, onSave }) {
  const parseHistory = () => {
    try {
      const h = typeof truck.weekend_history === 'string'
        ? JSON.parse(truck.weekend_history)
        : (Array.isArray(truck.weekend_history) ? truck.weekend_history : []);
      return [...h];
    } catch { return []; }
  };

  const [entries, setEntries] = useState(parseHistory);
  const [saving, setSaving] = useState(false);

  const setDuration = (idx, duration) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, duration } : e));
  };

  const deleteEntry = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(entries);
    setSaving(false);
    onClose();
  };

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.07em', textTransform: 'uppercase',
    color: 'var(--gray-4)', marginBottom: '10px',
    fontFamily: "'SF Pro Display', -apple-system, sans-serif",
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100, padding: '20px', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid var(--gray-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--black)', margin: 0, fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
                Istoric pauze — {truck.number}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--gray-4)', margin: '4px 0 0', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
                Modifică sau șterge înregistrări anterioare
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Entries */}
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-4)', fontSize: '14px', fontStyle: 'italic' }}>
            Niciun istoric înregistrat.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {[...entries].reverse().map((entry, revIdx) => {
              const idx = entries.length - 1 - revIdx;
              return (
                <div key={entry.week} style={{ background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '10px', padding: '14px 16px' }}>
                  <label style={labelStyle}>{entry.week}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Duration toggle */}
                    <div style={{ display: 'flex', flex: 1, gap: '8px' }}>
                      {['24H', '45H'].map(dur => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setDuration(idx, dur)}
                          style={{
                            flex: 1, padding: '9px 0', borderRadius: '8px', border: '1px solid',
                            borderColor: entry.duration === dur ? '#ff7a3d' : 'var(--gray-3)',
                            background: entry.duration === dur ? '#ff7a3d' : 'var(--bg-page)',
                            color: entry.duration === dur ? 'white' : 'var(--black)',
                            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: "'SF Pro Display', -apple-system, sans-serif",
                          }}
                        >
                          {dur}
                        </button>
                      ))}
                    </div>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => deleteEntry(idx)}
                      title="Șterge înregistrarea"
                      style={{ padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--gray-3)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--black)', cursor: 'pointer', transition: 'background 0.15s', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, padding: '12px', background: '#ff7a3d', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'all 0.15s', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#ff8c52'; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#ff7a3d'; }}
          >
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeekendHistoryModal;
