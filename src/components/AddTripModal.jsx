import { useState } from 'react';

function AddTripModal({ truck, onClose, onSave }) {
  const [formData, setFormData] = useState({
    client: '',
    order_number: '',
    load_location: '',
    load_date: '',
    load_time: '',
    load_coords: '',
    unload_location: '',
    unload_date: '',
    unload_time: '',
    unload_coords: '',
    observations: ''
  });

  const [copiedField, setCopiedField] = useState(null);

  const handleTimeChange = (field, value) => {
    const digits = value.replace(/\D/g, '');
    let formatted = digits.slice(0, 2);
    if (digits.length >= 3) {
      formatted += ':' + digits.slice(2, 4);
    }
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  const handleCopy = (field, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const CopyIcon = () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8.5 4.5V3C8.5 2.17 7.83 1.5 7 1.5H3C2.17 1.5 1.5 2.17 1.5 3V7C1.5 7.83 2.17 8.5 3 8.5H4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    // Parse coordonate încărcare
    const loadCoords = formData.load_coords.split(',').map(c => c.trim());
    const loadLat = loadCoords[0] || null;
    const loadLng = loadCoords[1] || null;
    
    // Parse coordonate descărcare
    const unloadCoords = formData.unload_coords.split(',').map(c => c.trim());
    const unloadLat = unloadCoords[0] || null;
    const unloadLng = unloadCoords[1] || null;
    
    // Format date to DD.MM.YYYY
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}.${month}.${year}`;
    };
    
    const data = {
      client: formData.client,
      order_number: formData.order_number,
      load_location: formData.load_location,
      load_date: formatDate(formData.load_date),
      load_time: formData.load_time,
      load_lat: loadLat,
      load_lng: loadLng,
      unload_location: formData.unload_location,
      unload_date: formatDate(formData.unload_date),
      unload_time: formData.unload_time,
      unload_lat: unloadLat,
      unload_lng: unloadLng,
      observations: formData.observations
    };
    
    onSave(data);
    onClose();
  };

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
          maxWidth: '800px',
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
            Adaugă Cursă — {truck.number}
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--gray-4)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Adaugă o cursă viitoare pentru acest camion
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Client & Nr. Comandă */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Client
              </label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                placeholder="Ex: EMEA Transport"
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
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Nr. Comandă
              </label>
              <input
                type="text"
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                placeholder="Ex: 12345-67"
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
          </div>

          {/* Separator */}
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            marginTop: '32px',
            color: '#ff7a3d',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Încărcare
          </div>

          {/* Locație Încărcare */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '8px',
              color: 'var(--black)',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              Locație
            </label>
            <input
              type="text"
              value={formData.load_location}
              onChange={(e) => setFormData({ ...formData, load_location: e.target.value })}
              placeholder="Ex: București, România"
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

          {/* Dată, Oră și Coordonate Încărcare */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Dată
              </label>
              <input
                type="date"
                value={formData.load_date}
                onChange={(e) => setFormData({ ...formData, load_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'var(--bg-page)',
                  color: 'var(--black)',
                  colorScheme: 'dark',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Oră
              </label>
              <input
                type="text"
                value={formData.load_time}
                onChange={(e) => handleTimeChange('load_time', e.target.value)}
                placeholder="HH:MM"
                maxLength={5}
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
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Coordonate
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={formData.load_coords}
                  onChange={(e) => setFormData({ ...formData, load_coords: e.target.value })}
                  placeholder="45.12, 25.34"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <button
                  type="button"
                  onClick={() => handleCopy('load_coords', formData.load_coords)}
                  title="Copiază coordonate"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: formData.load_coords ? 'pointer' : 'default',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: copiedField === 'load_coords' ? '#22c55e' : 'var(--gray-4)',
                    opacity: formData.load_coords ? 1 : 0.35,
                    transition: 'color 0.2s'
                  }}
                >
                  {copiedField === 'load_coords' ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            marginTop: '32px',
            color: '#ff7a3d',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Descărcare
          </div>

          {/* Locație Descărcare */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '8px',
              color: 'var(--black)',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              Locație
            </label>
            <input
              type="text"
              value={formData.unload_location}
              onChange={(e) => setFormData({ ...formData, unload_location: e.target.value })}
              placeholder="Ex: Timișoara, România"
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

          {/* Dată, Oră și Coordonate Descărcare */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Dată
              </label>
              <input
                type="date"
                value={formData.unload_date}
                onChange={(e) => setFormData({ ...formData, unload_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'var(--bg-page)',
                  color: 'var(--black)',
                  colorScheme: 'dark',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Oră
              </label>
              <input
                type="text"
                value={formData.unload_time}
                onChange={(e) => handleTimeChange('unload_time', e.target.value)}
                placeholder="HH:MM"
                maxLength={5}
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
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '8px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Coordonate
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={formData.unload_coords}
                  onChange={(e) => setFormData({ ...formData, unload_coords: e.target.value })}
                  placeholder="45.12, 25.34"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <button
                  type="button"
                  onClick={() => handleCopy('unload_coords', formData.unload_coords)}
                  title="Copiază coordonate"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: formData.unload_coords ? 'pointer' : 'default',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: copiedField === 'unload_coords' ? '#22c55e' : 'var(--gray-4)',
                    opacity: formData.unload_coords ? 1 : 0.35,
                    transition: 'color 0.2s'
                  }}
                >
                  {copiedField === 'unload_coords' ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
          </div>

          {/* Observații */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '8px',
              color: 'var(--black)',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
            }}>
              Observații
            </label>
            <textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              rows="3"
              placeholder="Adaugă observații despre cursă..."
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid var(--gray-3)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--black)',
                outline: 'none',
                resize: 'vertical',
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

export default AddTripModal;
