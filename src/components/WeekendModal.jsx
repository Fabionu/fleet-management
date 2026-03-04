import { useState } from 'react';

function WeekendModal({ truck, onClose, onSave }) {
  const [formData, setFormData] = useState({
    duration: truck.weekend_duration || '45H',
    day: truck.weekend_day || 'Sâm',
    time: truck.weekend_time || '18:00'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const days = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          marginBottom: '32px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--gray-2)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--black)',
            marginBottom: '4px',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Weekend — {truck.number}
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--gray-4)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Configurează pauza săptămânală
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Durată */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '12px',
              color: 'var(--black)',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              Durată Pauză
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, duration: '24H' })}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: formData.duration === '24H' ? '#ff7a3d' : 'var(--gray-1)',
                  border: '1px solid',
                  borderColor: formData.duration === '24H' ? '#ff7a3d' : 'var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: formData.duration === '24H' ? 'white' : 'var(--black)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                24H
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, duration: '45H' })}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: formData.duration === '45H' ? '#ff7a3d' : 'var(--gray-1)',
                  border: '1px solid',
                  borderColor: formData.duration === '45H' ? '#ff7a3d' : 'var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: formData.duration === '45H' ? 'white' : 'var(--black)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                45H
              </button>
            </div>
          </div>

          {/* Zi */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '12px',
              color: 'var(--black)',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              Ziua Începerii
            </label>
            <select
              value={formData.day}
              onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--black)',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
              onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
            >
              {days.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          {/* Oră */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '12px',
              color: 'var(--black)',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              Ora Începerii
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--black)',
                outline: 'none',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
              onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                background: 'var(--gray-1)',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--black)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--gray-2)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--gray-1)'}
            >
              Anulează
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '14px',
                background: '#ff7a3d',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
              onMouseEnter={(e) => e.target.style.background = '#ff8c52'}
              onMouseLeave={(e) => e.target.style.background = '#ff7a3d'}
            >
              Salvează
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WeekendModal;
