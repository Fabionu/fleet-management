import { useState, useEffect, useRef } from 'react';
import Login from './pages/Login';
import Tracking from './pages/Tracking';
import Admin from './pages/Admin';
import Curse from './pages/Curse';
import Dashboard from './pages/Dashboard';
import ChatPanel from './components/ChatPanel';
import { connectSocket, disconnectSocket, getSocket } from './services/socket';
import { api } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(
    localStorage.getItem('currentPage') || 'tracking'
  );
  const [theme, setTheme] = useState('dark');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [trackingView, setTrackingView] = useState('card');
  const [alerts, setAlerts]         = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [bodyZoom, setBodyZoom]     = useState(1);
  const userMenuRef = useRef(null);
  const bellRef     = useRef(null);

  // Auto-zoom bazat pe rezolutia ecranului
  useEffect(() => {
    const applyZoom = () => {
      const w = window.innerWidth;
      let zoom = 1;
      if (w <= 1366)      zoom = 0.80;
      else if (w <= 1600) zoom = 0.88;
      else if (w <= 1920) zoom = 1.00;
      else if (w <= 2300) zoom = 1.10;
      else                zoom = 1.00;
      document.body.style.zoom = zoom;
      setBodyZoom(zoom);
    };
    applyZoom();
    window.addEventListener('resize', applyZoom);
    return () => window.removeEventListener('resize', applyZoom);
  }, []);

  // Helper function to change page and save to localStorage
  const changePage = (page) => {
    setCurrentPage(page);
    localStorage.setItem('currentPage', page);
    if (page === 'admin') {
      localStorage.removeItem('adminSection');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Alerte documente — fetch la login + interval 5 min
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchAlerts = async () => {
      try { const res = await api.getDocumentAlerts(); setAlerts(res.data); } catch {}
    };
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [isAuthenticated]);

  useEffect(() => {
    // Check if user is logged in — verifică ambele storages (localStorage = "ține-mă minte", sessionStorage = sesiune temporară)
    const storage = localStorage.getItem('authToken') ? localStorage : sessionStorage;
    const token = storage.getItem('authToken');
    const username = storage.getItem('fleetUser');
    if (token && username) {
      // Conectează socket-ul ÎNAINTE de setIsAuthenticated
      // astfel încât getSocket() returnează instanța când Tracking.jsx se montează
      const sock = connectSocket();
      if (sock) {
        sock.on('connect', () => setSocketConnected(true));
        sock.on('disconnect', () => setSocketConnected(false));
        if (sock.connected) setSocketConnected(true);
      }
      setIsAuthenticated(true);
      const role = storage.getItem('role');
      setUser({
        username,
        role,
        permissions: JSON.parse(storage.getItem('permissions') || '{}'),
        organizationName: storage.getItem('organizationName'),
        first_name: storage.getItem('firstName') || '',
        last_name: storage.getItem('lastName') || '',
      });
      if (role === 'camion') setCurrentPage('chat');
      setTrackingView(localStorage.getItem(`trackingView_${username}`) || 'card');
    }

    // Set theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleLogin = (data, rememberMe = true) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('authToken', data.token);
    storage.setItem('fleetUser', data.username);
    storage.setItem('role', data.role);
    storage.setItem('permissions', JSON.stringify(data.permissions));
    storage.setItem('organizationName', data.organization_name);
    storage.setItem('firstName', data.first_name || '');
    storage.setItem('lastName', data.last_name || '');

    setIsAuthenticated(true);
    setUser({
      username: data.username,
      role: data.role,
      permissions: data.permissions,
      organizationName: data.organization_name,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
    });
    if (data.role === 'camion') setCurrentPage('chat');
    setTrackingView(localStorage.getItem(`trackingView_${data.username}`) || 'card');

    // Conectează socket după login
    const sock = connectSocket();
    if (sock) {
      sock.on('connect', () => setSocketConnected(true));
      sock.on('disconnect', () => setSocketConnected(false));
      if (sock.connected) setSocketConnected(true);
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    // Ștergem doar cheile de autentificare, păstrăm preferințele per user (trackingView_*, theme)
    ['authToken', 'fleetUser', 'role', 'permissions', 'organizationName',
     'currentPage', 'adminSection', 'adminActiveSection'].forEach(k => {
      localStorage.removeItem(k);
    });
    sessionStorage.clear();
    window.location.reload();
  };

  // Actualizează starea socketConnected dacă socket-ul era deja conectat la mount
  useEffect(() => {
    if (isAuthenticated) {
      const sock = connectSocket();
      if (sock?.connected) setSocketConnected(true);
    }
  }, [isAuthenticated]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTrackingView = () => {
    const next = trackingView === 'card' ? 'standard' : 'card';
    setTrackingView(next);
    if (user) localStorage.setItem(`trackingView_${user.username}`, next);
    setUserMenuOpen(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{
      height: currentPage === 'chat' ? `${window.innerHeight / bodyZoom}px` : undefined,
      minHeight: currentPage === 'chat' ? undefined : '100vh',
      background: 'var(--bg-body)',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        background: 'var(--bg-page)',
        border: '1px solid var(--gray-2)',
        borderRadius: '16px',
        padding: currentPage === 'chat' ? '32px 32px 0 32px' : '32px',
        boxShadow: '0 8px 30px var(--shadow)',
        position: 'relative',
        height: currentPage === 'chat' ? `${(window.innerHeight - 40) / bodyZoom}px` : undefined,
        display: currentPage === 'chat' ? 'flex' : undefined,
        flexDirection: currentPage === 'chat' ? 'column' : undefined,
      }}>
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: 'var(--black)',
            transition: 'opacity 0.2s',
            padding: '8px'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.7'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>


        {/* Controls bar — Bell + User menu (un singur card integrat) */}
        <div style={{ position: 'absolute', top: '28px', right: '80px', zIndex: 101, display: 'flex', alignItems: 'stretch', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: '10px' }}>

          {/* ── Clopoțel alerte ── */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            {(() => {
              const TYPE_LABEL = { driver: 'Șofer', truck: 'Camion', trailer: 'Remorcă' };
              const TYPE_COLOR = { driver: '#8b5cf6', truck: '#3b82f6', trailer: '#14b8a6' };
              const DOC_LABEL  = {
                pasaport:'Pașaport', permis:'Permis conducere', ci:'C.I.',
                tahograf:'Card tahograf', a1macron:'A1 Macron',
                itp:'ITP', rca:'RCA', casco:'CASCO', cemt:'CEMT',
                licenta:'Licență transport', ITP:'ITP', RCA:'RCA',
              };
              const expired    = alerts.filter(a => a.days_left < 0);
              const expiring   = alerts.filter(a => a.days_left >= 0);
              const sorted     = [...expired, ...expiring];
              const badgeCount = alerts.length;
              const badgeColor = expired.length > 0 ? 'var(--red)' : '#f59e0b';
              return (
                <>
                  <button
                    onClick={() => { setAlertsOpen(o => !o); setUserMenuOpen(false); }}
                    title="Alerte documente"
                    style={{
                      height: '100%', padding: '0 13px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', position: 'relative',
                      color: alertsOpen ? '#ff7a3d' : 'var(--gray-4)',
                      borderRadius: '9px 0 0 9px',
                      transition: 'color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = alertsOpen ? '#ff7a3d' : 'var(--black)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = alertsOpen ? '#ff7a3d' : 'var(--gray-4)'; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 8a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8"/>
                      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                    </svg>
                    {badgeCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: badgeColor, color: '#fff',
                        borderRadius: '50%', minWidth: 16, height: 16,
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px', boxSizing: 'border-box',
                        border: '1.5px solid var(--gray-1)', lineHeight: 1,
                      }}>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </button>

                  {alertsOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                      width: 340, maxHeight: 440, overflowY: 'auto',
                      background: 'var(--bg-page)', border: '1px solid var(--gray-2)',
                      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                      zIndex: 9998, fontFamily: "'SF Pro Display',-apple-system,sans-serif",
                    }}>
                      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-page)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                          </svg>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)' }}>Alerte documente</span>
                        </div>
                        {badgeCount > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: expired.length > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(245,158,11,0.12)', color: badgeColor }}>
                            {expired.length > 0 && `${expired.length} expirat${expired.length > 1 ? 'e' : ''}`}
                            {expired.length > 0 && expiring.length > 0 && ' · '}
                            {expiring.length > 0 && `${expiring.length} curând`}
                          </span>
                        )}
                      </div>

                      {sorted.length === 0 ? (
                        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 10px' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>Toate documentele sunt în regulă</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 4 }}>Nicio expirare în următoarele 30 de zile</div>
                        </div>
                      ) : (
                        sorted.map((a, i) => {
                          const isExp    = a.days_left < 0;
                          const dotColor = isExp ? 'var(--red)' : a.days_left <= 7 ? '#f97316' : '#f59e0b';
                          const dayLabel = isExp
                            ? `Expirat${Math.abs(a.days_left) > 0 ? ` acum ${Math.abs(a.days_left)}z` : ''}`
                            : a.days_left === 0 ? 'Expiră azi' : `${a.days_left} zi${a.days_left === 1 ? '' : 'le'}`;
                          return (
                            <div key={i}
                              onClick={() => { changePage('admin'); setAlertsOpen(false); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < sorted.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }}/>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.entity_name}</span>
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, flexShrink: 0, letterSpacing: '0.02em', background: TYPE_COLOR[a.type] + '18', color: TYPE_COLOR[a.type] }}>{TYPE_LABEL[a.type]}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>{DOC_LABEL[a.doc_type] || a.doc_type}</div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: dotColor }}>{dayLabel}</div>
                            </div>
                          );
                        })
                      )}

                      {sorted.length > 0 && (
                        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gray-2)', textAlign: 'center', position: 'sticky', bottom: 0, background: 'var(--bg-page)' }}>
                          <button onClick={() => { changePage('admin'); setAlertsOpen(false); }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#ff7a3d', fontWeight: 600, fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6 }}>
                            Mergi la Admin →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* ── Separator vertical ── */}
          <div style={{ width: '1px', background: 'var(--gray-3)', margin: '8px 0' }} />

          {/* ── Buton user ── */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); setAlertsOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'transparent', border: 'none',
                borderRadius: '0 9px 9px 0',
                padding: '10px 14px', cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '14px' }}>
                  {user.first_name ? user.first_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                  {user.last_name ? user.last_name.charAt(0).toUpperCase() : ''}
                </div>
                <div
                  title={socketConnected ? 'Timp real activ' : 'Reconectare...'}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: socketConnected ? '#22c55e' : '#f59e0b', border: '2px solid var(--gray-1)', transition: 'background 0.4s' }}
                />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', whiteSpace: 'nowrap' }}>
                  {(user.first_name || user.last_name)
                    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
                    : user.username}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>
                  @{user.username} · {user.role === 'admin' ? 'Administrator' : user.role === 'dispatcher' ? 'Dispecer' : 'Contabil'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: '0', background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: '8px', boxShadow: '0 4px 12px var(--shadow)', minWidth: '100%', zIndex: 1000, overflow: 'hidden' }}>
                {currentPage === 'tracking' && (
                  <button
                    onClick={toggleTrackingView}
                    style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {trackingView === 'card' ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                        Standard View
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                        </svg>
                        Card View
                      </>
                    )}
                  </button>
                )}
                <div style={{ height: '1px', background: 'var(--gray-2)' }} />
                <button
                  onClick={handleLogout}
                  style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--black)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Delogare
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
           display: 'flex',
           alignItems: 'center',
           marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                <rect x="1" y="5" width="15" height="10" rx="2"/>
                <path d="M16 8h3l3 3v4h-3"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <circle cx="18.5" cy="17.5" r="2.5"/>
              </svg>
              <div>
                <h1 style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--black)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}>
                  {(user.organizationName && user.organizationName !== 'Default') ? user.organizationName : 'Fleet Management'}
                </h1>
              </div>
            </div>
           </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--gray-2)' }}>
            {(user.role === 'admin' || user.permissions?.viewTracking !== false) && (
            <button
              onClick={() => changePage('tracking')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${currentPage === 'tracking' ? '#ff7a3d' : 'transparent'}`,
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: currentPage === 'tracking' ? '#ff7a3d' : 'var(--gray-4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              Status flotă
            </button>
            )}
            {(user.role === 'admin' || user.permissions?.viewRegistru !== false) && (
            <button
              onClick={() => changePage('curse')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${currentPage === 'curse' ? '#ff7a3d' : 'transparent'}`,
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: currentPage === 'curse' ? '#ff7a3d' : 'var(--gray-4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              Registru
            </button>
            )}
            {(user.role === 'admin' || user.permissions?.viewChat !== false) && (
            <button
              onClick={() => changePage('chat')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${currentPage === 'chat' ? '#ff7a3d' : 'transparent'}`,
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: currentPage === 'chat' ? '#ff7a3d' : 'var(--gray-4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </button>
            )}
            {(user.role === 'admin' || user.permissions?.viewReports) && (
              <button
                onClick={() => changePage('rapoarte')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${currentPage === 'rapoarte' ? '#ff7a3d' : 'transparent'}`,
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: currentPage === 'rapoarte' ? '#ff7a3d' : 'var(--gray-4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '-2px'
                }}
              >
                Rapoarte
              </button>
            )}
            {(user.role === 'admin' || user.permissions?.accessAdmin) && (
              <button
                onClick={() => changePage('admin')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${currentPage === 'admin' ? '#ff7a3d' : 'transparent'}`,
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: currentPage === 'admin' ? '#ff7a3d' : 'var(--gray-4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '-2px'
                }}
              >
                Panou admin
              </button>
            )}
          </div>
        </div>

        {/* Page Content */}
        {currentPage === 'tracking' && (user.role === 'admin' || user.permissions?.viewTracking !== false) && <Tracking user={user} viewMode={trackingView} />}
        {currentPage === 'curse'    && (user.role === 'admin' || user.permissions?.viewRegistru !== false)  && <Curse user={user} />}
        {currentPage === 'rapoarte' && (user.role === 'admin' || user.permissions?.viewReports)             && <Dashboard user={user} />}
        {currentPage === 'admin'    && (user.role === 'admin' || user.permissions?.accessAdmin)             && <Admin user={user} />}
        <div style={{ flex: currentPage === 'chat' ? 1 : undefined, minHeight: currentPage === 'chat' ? 0 : undefined, display: 'flex', flexDirection: 'column' }}>
          {(user.role === 'admin' || user.permissions?.viewChat !== false) && <ChatPanel user={user} currentPage={currentPage} />}
        </div>
      </div>
    </div>
  );
}

export default App;