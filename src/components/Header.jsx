import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

function BellIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  );
}

const TYPE_LABEL = { driver: 'Șofer', truck: 'Camion', trailer: 'Remorcă' };
const TYPE_COLOR = { driver: '#8b5cf6', truck: '#3b82f6', trailer: '#14b8a6' };
const DOC_LABEL  = {
  pasaport: 'Pașaport', permis: 'Permis conducere', ci: 'C.I.',
  tahograf: 'Card tahograf', a1macron: 'A1 Macron',
  itp: 'ITP', rca: 'RCA', casco: 'CASCO', cemt: 'CEMT',
  licenta: 'Licență transport', ITP: 'ITP', RCA: 'RCA',
};

export default function Header({ user, onLogout, onNavigate }) {
  const [alerts, setAlerts]         = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const bellRef = useRef(null);

  const fetchAlerts = async () => {
    try { const res = await api.getDocumentAlerts(); setAlerts(res.data); } catch {}
  };

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setAlertsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const expired  = alerts.filter(a => a.days_left < 0);
  const expiring = alerts.filter(a => a.days_left >= 0);
  const sorted   = [...expired, ...expiring];
  const badgeCount = alerts.length;
  const badgeColor = expired.length > 0 ? 'var(--red)' : '#f59e0b';

  return (
    <div className="header">
      <div className="header-top">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="5" width="15" height="10" rx="2"/>
          <path d="M16 8h3l3 3v4h-3"/>
          <circle cx="5.5" cy="17.5" r="2.5"/>
          <circle cx="18.5" cy="17.5" r="2.5"/>
        </svg>
        <span className="org-name">
          {(user.organizationName && user.organizationName !== 'Default')
            ? user.organizationName.toUpperCase() : 'FLEET MANAGEMENT'}
        </span>
      </div>
      <h1><strong>Fleet Management System</strong></h1>

      <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* ── Clopoțel alerte ── */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAlertsOpen(o => !o)}
            title="Alerte documente"
            style={{
              background: alertsOpen ? 'var(--gray-1)' : 'transparent',
              border: 'none', cursor: 'pointer',
              padding: '6px 7px', borderRadius: 8, position: 'relative',
              color: alertsOpen ? '#ff7a3d' : 'var(--gray-4)',
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; if (!alertsOpen) e.currentTarget.style.color = 'var(--black)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = alertsOpen ? 'var(--gray-1)' : 'transparent'; if (!alertsOpen) e.currentTarget.style.color = 'var(--gray-4)'; }}
          >
            <BellIcon size={18} />
            {badgeCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: badgeColor, color: '#fff',
                borderRadius: '50%', minWidth: 16, height: 16,
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', boxSizing: 'border-box',
                border: '1.5px solid var(--bg)',
                lineHeight: 1,
              }}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </button>

          {/* ── Dropdown ── */}
          {alertsOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, maxHeight: 440, overflowY: 'auto',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              zIndex: 9998,
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
              {/* Header */}
              <div style={{
                padding: '12px 16px 10px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <BellIcon size={14} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>
                    Alerte documente
                  </span>
                </div>
                {badgeCount > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 20,
                    background: badgeColor === 'var(--red)' ? 'rgba(220,38,38,0.12)' : 'rgba(245,158,11,0.12)',
                    color: badgeColor,
                  }}>
                    {expired.length > 0 && `${expired.length} expirat${expired.length > 1 ? 'e' : ''}`}
                    {expired.length > 0 && expiring.length > 0 && ' · '}
                    {expiring.length > 0 && `${expiring.length} curând`}
                  </span>
                )}
              </div>

              {/* Stare goală */}
              {sorted.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
                       stroke="#22c55e" strokeWidth="1.5"
                       strokeLinecap="round" strokeLinejoin="round"
                       style={{ display: 'block', margin: '0 auto 10px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                    Toate documentele sunt în regulă
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 4 }}>
                    Nicio expirare în următoarele 30 de zile
                  </div>
                </div>
              ) : (
                sorted.map((a, i) => {
                  const isExp   = a.days_left < 0;
                  const dotColor = isExp ? 'var(--red)' : a.days_left <= 7 ? '#f97316' : '#f59e0b';
                  const dayLabel = isExp
                    ? `Expirat${Math.abs(a.days_left) > 0 ? ` acum ${Math.abs(a.days_left)}z` : ''}`
                    : a.days_left === 0 ? 'Expiră azi'
                    : `${a.days_left} zi${a.days_left === 1 ? '' : 'le'}`;
                  return (
                    <div key={i}
                      onClick={() => { onNavigate?.('admin'); setAlertsOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 16px',
                        borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: dotColor, flexShrink: 0,
                      }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 600, color: 'var(--black)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {a.entity_name}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px',
                            borderRadius: 10, flexShrink: 0, letterSpacing: '0.02em',
                            background: TYPE_COLOR[a.type] + '18',
                            color: TYPE_COLOR[a.type],
                          }}>
                            {TYPE_LABEL[a.type]}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>
                          {DOC_LABEL[a.doc_type] || a.doc_type}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: dotColor }}>
                        {dayLabel}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Footer */}
              {sorted.length > 0 && (
                <div style={{
                  padding: '8px 16px', borderTop: '1px solid var(--border)',
                  textAlign: 'center',
                  position: 'sticky', bottom: 0, background: 'var(--surface)',
                }}>
                  <button onClick={() => { onNavigate?.('admin'); setAlertsOpen(false); }}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: '#ff7a3d', fontWeight: 600,
                      fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6,
                    }}>
                    Mergi la Admin →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <span className="username">{user.username}</span>
        <span className="role">({user.role})</span>
        <button onClick={onLogout} className="btn-logout">Delogare</button>
      </div>
    </div>
  );
}
