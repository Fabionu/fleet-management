import { useState } from 'react';

function EditTripModal({ truck, onClose, onSave }) {
  // Parse date and time from truck data
  const parseDateTime = (dateStr, timeStr) => {
    if (!dateStr) return { date: '', time: '' };
    const parts = dateStr.split('.');
    const date = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
    return { date, time: timeStr || '' };
  };

  const loadDateTime = parseDateTime(truck.load_date, truck.load_time);
  const unloadDateTime = parseDateTime(truck.unload_date, truck.unload_time);

  const [formData, setFormData] = useState({
    client: truck.client || '',
    order_number: truck.order_number || '',
    load_firm: truck.load_firm || '',
    load_street: truck.load_street || '',
    load_location: truck.load_location || '',
    load_date: loadDateTime.date,
    load_time: loadDateTime.time,
    load_coords: truck.load_lat && truck.load_lng ? `${truck.load_lat}, ${truck.load_lng}` : '',
    unload_firm: truck.unload_firm || '',
    unload_street: truck.unload_street || '',
    unload_location: truck.unload_location || '',
    unload_date: unloadDateTime.date,
    unload_time: unloadDateTime.time,
    unload_coords: truck.unload_lat && truck.unload_lng ? `${truck.unload_lat}, ${truck.unload_lng}` : '',
    observations: truck.observations || ''
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

  const [saving, setSaving] = useState(false);

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
      load_firm: formData.load_firm,
      load_street: formData.load_street,
      load_location: formData.load_location,
      load_date: formatDate(formData.load_date),
      load_time: formData.load_time,
      load_lat: loadLat,
      load_lng: loadLng,
      unload_firm: formData.unload_firm,
      unload_street: formData.unload_street,
      unload_location: formData.unload_location,
      unload_date: formatDate(formData.unload_date),
      unload_time: formData.unload_time,
      unload_lat: unloadLat,
      unload_lng: unloadLng,
      observations: formData.observations
    };

    setSaving(true);
    onSave(data);
    onClose();
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--gray-3)',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'var(--bg-page)',
    color: 'var(--black)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '6px',
    color: 'var(--black)',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
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
    >
      <div
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)',
          borderRadius: '16px',
          padding: '28px 36px',
          maxWidth: '1000px',
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--gray-2)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--black)',
            marginBottom: '4px',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Editare Cursă — {truck.number}
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--gray-4)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Modifică detaliile cursei curente
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Client & Nr. Comandă */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Client</label>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                placeholder="Ex: EMEA Transport"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
            <div>
              <label style={labelStyle}>Nr. Comandă</label>
              <input
                type="text"
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                placeholder="Ex: 12345-67"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
          </div>

          {/* Încărcare & Descărcare — side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

            {/* ÎNCĂRCARE */}
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                color: '#ff7a3d',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Încărcare
              </div>

              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  value={formData.load_firm}
                  onChange={(e) => setFormData({ ...formData, load_firm: e.target.value })}
                  placeholder="Nume firmă (opțional)"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  value={formData.load_street}
                  onChange={(e) => setFormData({ ...formData, load_street: e.target.value })}
                  placeholder="Stradă / Zonă industrială (opțional)"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  value={formData.load_location}
                  onChange={(e) => setFormData({ ...formData, load_location: e.target.value })}
                  placeholder="Ex: DE 40599 Düsseldorf"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>

              {/* Dată & Oră Încărcare */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label style={labelStyle}>Dată</label>
                  <input
                    type="date"
                    value={formData.load_date}
                    onChange={(e) => setFormData({ ...formData, load_date: e.target.value })}
                    style={{ ...inputStyle, colorScheme: 'light' }}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Oră</label>
                  <input
                    type="text"
                    value={formData.load_time}
                    onChange={(e) => handleTimeChange('load_time', e.target.value)}
                    placeholder="HH:MM"
                    maxLength={5}
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                </div>
              </div>
              {/* Coordonate Încărcare */}
              <div>
                <label style={labelStyle}>Coordonate</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={formData.load_coords}
                    onChange={(e) => setFormData({ ...formData, load_coords: e.target.value })}
                    placeholder="45.12, 25.34"
                    style={{ ...inputStyle, padding: '10px 36px 10px 12px' }}
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

            {/* DESCĂRCARE */}
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                color: '#ff7a3d',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Descărcare
              </div>

              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  value={formData.unload_firm}
                  onChange={(e) => setFormData({ ...formData, unload_firm: e.target.value })}
                  placeholder="Nume firmă (opțional)"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  value={formData.unload_street}
                  onChange={(e) => setFormData({ ...formData, unload_street: e.target.value })}
                  placeholder="Stradă / Zonă industrială (opțional)"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  value={formData.unload_location}
                  onChange={(e) => setFormData({ ...formData, unload_location: e.target.value })}
                  placeholder="Ex: DE 10117 Berlin"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>

              {/* Dată & Oră Descărcare */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label style={labelStyle}>Dată</label>
                  <input
                    type="date"
                    value={formData.unload_date}
                    onChange={(e) => setFormData({ ...formData, unload_date: e.target.value })}
                    style={{ ...inputStyle, colorScheme: 'light' }}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Oră</label>
                  <input
                    type="text"
                    value={formData.unload_time}
                    onChange={(e) => handleTimeChange('unload_time', e.target.value)}
                    placeholder="HH:MM"
                    maxLength={5}
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                </div>
              </div>
              {/* Coordonate Descărcare */}
              <div>
                <label style={labelStyle}>Coordonate</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={formData.unload_coords}
                    onChange={(e) => setFormData({ ...formData, unload_coords: e.target.value })}
                    placeholder="45.12, 25.34"
                    style={{ ...inputStyle, padding: '10px 36px 10px 12px' }}
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

          </div>

          {/* Observații */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Observații</label>
            <textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              rows="3"
              placeholder="Adaugă observații despre cursă..."
              style={{
                ...inputStyle,
                resize: 'vertical'
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
                padding: '13px',
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
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gray-1)'}
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '13px',
                background: saving ? 'var(--gray-3)' : '#ff7a3d',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.2s',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#ff8c52'; }}
              onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#ff7a3d'; }}
            >
              {saving && <svg style={{ animation: 'spin-loader 0.8s linear infinite', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditTripModal;
