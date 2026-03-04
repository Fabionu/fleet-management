import { useState } from 'react';
import { api } from '../services/api';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(username, password);
      onLogin(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Utilizator sau parolă incorectă');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a1a',
      padding: '20px',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        background: '#242424',
        border: '1px solid #2f2f2f',
        borderRadius: '16px',
        padding: '56px 48px',
        width: '100%',
        maxWidth: '440px',
        minHeight: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <svg 
            width="56" 
            height="56" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#ff7a3d" 
            strokeWidth="2"
            style={{ marginBottom: '20px' }}
          >
            <rect x="1" y="5" width="15" height="10" rx="2"/>
            <path d="M16 8h3l3 3v4h-3"/>
            <circle cx="5.5" cy="17.5" r="2.5"/>
            <circle cx="18.5" cy="17.5" r="2.5"/>
          </svg>
          <h1 style={{
            fontSize: '26px',
            fontWeight: 600,
            color: '#ffffff',
            marginBottom: '10px',
            letterSpacing: '-0.02em'
          }}>
            Fleet Management
          </h1>
          <p style={{
            color: '#b8b8b8',
            fontSize: '14px',
            fontWeight: 400
          }}>
            Introduceți credențialele pentru acces
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '10px',
              color: '#e8e8e8',
              letterSpacing: '-0.01em'
            }}>
              Utilizator
            </label>
            <div style={{ position: 'relative' }}>
              <svg 
  width="20" 
  height="20"
  viewBox="0 0 24 24" 
  fill="none" 
  stroke={usernameFocused ? '#ff7a3d' : '#b8b8b8'}
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  style={{
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'stroke 0.2s'
  }}
>
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
  <circle cx="12" cy="7" r="4"></circle>
</svg>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
                placeholder="Introduceți username"
                autoFocus
                required
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  border: `2px solid ${usernameFocused ? '#ff7a3d' : '#505050'}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  background: '#1a1a1a',
                  color: '#ffffff',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontWeight: 400
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '10px',
              color: '#e8e8e8',
              letterSpacing: '-0.01em'
            }}>
              Parolă
            </label>
            <div style={{ position: 'relative' }}>
              <svg 
  width="20" 
  height="20"
  viewBox="0 0 24 24" 
  fill="none" 
  stroke={passwordFocused ? '#ff7a3d' : '#b8b8b8'}
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  style={{
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    transition: 'stroke 0.2s'
  }}
>
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Introduceți parola"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  border: `2px solid ${passwordFocused ? '#ff7a3d' : '#505050'}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  background: '#1a1a1a',
                  color: '#ffffff',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontWeight: 400
                }}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#2e1a1a',
              border: '1px solid #ef4444',
              color: '#ef4444',
              padding: '14px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
  <line x1="12" y1="9" x2="12" y2="13"></line>
  <line x1="12" y1="17" x2="12.01" y2="17"></line>
</svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#505050' : '#ff7a3d',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(255, 122, 61, 0.4)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = '#ff8c52';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(255, 122, 61, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = loading ? '#505050' : '#ff7a3d';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = loading ? 'none' : '0 4px 14px rgba(255, 122, 61, 0.4)';
            }}
          >
            {loading ? 'Se încarcă...' : 'Autentificare →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;