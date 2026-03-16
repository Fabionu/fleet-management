import { useState, useEffect, useRef } from 'react';
import Login from './pages/Login';
import Tracking from './pages/Tracking';
import Admin from './pages/Admin';
import Curse from './pages/Curse';
import ChatPanel from './components/ChatPanel';
import { connectSocket, disconnectSocket, getSocket } from './services/socket';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(
    localStorage.getItem('currentPage') || 'tracking'
  );
  const [theme, setTheme] = useState('dark');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [trackingView, setTrackingView] = useState(
    () => localStorage.getItem('trackingView') || 'card'
  );
  const userMenuRef = useRef(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('fleetUser');
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
      setUser({
        username,
        role: localStorage.getItem('role'),
        permissions: JSON.parse(localStorage.getItem('permissions') || '{}'),
        organizationName: localStorage.getItem('organizationName')
      });
    }

    // Set theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleLogin = (data) => {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('fleetUser', data.username);
    localStorage.setItem('role', data.role);
    localStorage.setItem('permissions', JSON.stringify(data.permissions));
    localStorage.setItem('organizationName', data.organization_name);

    setIsAuthenticated(true);
    setUser({
      username: data.username,
      role: data.role,
      permissions: data.permissions,
      organizationName: data.organization_name
    });

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
    setSocketConnected(false);
    localStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
    setCurrentPage('tracking');
    localStorage.setItem('currentPage', 'tracking');
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
    localStorage.setItem('trackingView', next);
    setUserMenuOpen(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-body)',
      padding: '20px',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        background: 'var(--bg-page)',
        border: '1px solid var(--gray-2)',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 8px 30px var(--shadow)',
        position: 'relative'
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


        {/* User Menu - Absolute Position */}
        <div style={{ position: 'absolute', top: '32px', right: '80px', zIndex: 100 }} ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--gray-1)',
              border: '1px solid var(--gray-3)',
              borderRadius: '8px',
              padding: '10px 16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-2)';
              e.currentTarget.style.borderColor = 'var(--orange)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gray-1)';
              e.currentTarget.style.borderColor = 'var(--gray-3)';
            }}
          >
            <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#ff7a3d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px'
              }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div
                title={socketConnected ? 'Timp real activ' : 'Reconectare...'}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: socketConnected ? '#22c55e' : '#f59e0b',
                  border: '2px solid var(--gray-1)',
                  transition: 'background 0.4s',
                }}
              />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--black)'
              }}>
                {user.username}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--gray-4)'
              }}>
                {user.role === 'admin' ? 'Administrator' : user.role === 'dispatcher' ? 'Dispecer' : 'Contabil'}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '8px',
              background: 'var(--bg-page)',
              border: '1px solid var(--gray-2)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px var(--shadow)',
              width: '100%',
              minWidth: 'auto',
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              {/* View toggle — vizibil doar pe pagina tracking */}
              {currentPage === 'tracking' && (
                <button
                  onClick={toggleTrackingView}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: 'var(--black)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: 'var(--black)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Delogare
              </button>
            </div>
          )}
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
                <div style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#ff7a3d',
                  marginBottom: '2px'
                }}>
                  {(user.organizationName && user.organizationName !== 'Default') ? user.organizationName.toUpperCase() : 'FLEET MANAGEMENT'}
                </div>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'var(--black)',
                  letterSpacing: '-0.02em'
                }}>
                  Fleet Management System
                </h1>
              </div>
            </div>
           </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--gray-2)' }}>
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
              Curse
            </button>
{user.role === 'admin' && (
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
        {currentPage === 'tracking' && <Tracking user={user} viewMode={trackingView} />}
        {currentPage === 'curse' && <Curse user={user} />}
{currentPage === 'admin' && <Admin user={user} />}
      </div>
      <ChatPanel user={user} />
    </div>
  );
}

export default App;