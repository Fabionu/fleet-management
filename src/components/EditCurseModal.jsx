import { useState } from 'react';

// Parsează "DD.MM.YYYY HH:MM" → { date: "YYYY-MM-DD", time: "HH:MM" }
function parseDateTime(str) {
  if (!str) return { date: '', time: '' };
  const [datePart, timePart] = str.split(' ');
  if (!datePart) return { date: '', time: '' };
  const parts = datePart.split('.');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return { date: `${y}-${m}-${d}`, time: timePart || '' };
  }
  return { date: '', time: timePart || '' };
}

function EditCurseModal({ trip, trucks, onClose, onSave }) {
  const loadParsed = parseDateTime(trip.load_date);
  const unloadParsed = parseDateTime(trip.unload_date);

  const [formData, setFormData] = useState({
    client: trip.client || '',
    order_number: trip.order_number || '',
    load_location: trip.load_location || '',
    load_date: loadParsed.date,
    load_time: loadParsed.time,
    load_coords: trip.load_coords || '',
    unload_location: trip.unload_location || '',
    unload_date: unloadParsed.date,
    unload_time: unloadParsed.time,
    unload_coords: trip.unload_coords || '',
    km_empty: trip.km_empty ?? '',
    km_loaded: trip.km_loaded ?? '',
    price: trip.price ?? '',
    truck: trip.truck_number || '',
    drivers: trip.driver || '',
    pdf_file: null
  });

  const [pdfFileName, setPdfFileName] = useState(trip.file_name || '');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeChange = (field, value) => {
    const digits = value.replace(/\D/g, '');
    let formatted = digits.slice(0, 2);
    if (digits.length >= 3) {
      formatted += ':' + digits.slice(2, 4);
    }
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  const handleTruckChange = (truckNumber) => {
    const selectedTruck = trucks.find(t => t.number === truckNumber);
    setFormData(prev => ({
      ...prev,
      truck: truckNumber,
      drivers: selectedTruck?.drivers || prev.drivers
    }));
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setFormData(prev => ({ ...prev, pdf_file: file }));
      setPdfFileName(file.name);
    } else {
      alert('Te rog să încarci un fișier PDF valid!');
      e.target.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData, trip.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
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
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
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
            Editează Cursă
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--gray-4)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Modifică detaliile cursei — câmpurile PDF sunt opționale dacă nu schimbi comanda
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Client & Nr. Comandă */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Client *
              </label>
              <input
                type="text"
                required
                value={formData.client}
                onChange={(e) => handleChange('client', e.target.value)}
                placeholder="Ex: EMEA Transport"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Nr. Comandă *
              </label>
              <input
                type="text"
                required
                value={formData.order_number}
                onChange={(e) => handleChange('order_number', e.target.value)}
                placeholder="Ex: 14557-26"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
          </div>

          {/* Încărcare & Descărcare */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* ÎNCĂRCARE */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: '#ff7a3d', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Încărcare
              </div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  required
                  value={formData.load_location}
                  onChange={(e) => handleChange('load_location', e.target.value)}
                  placeholder="Locație completă"
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="date"
                  value={formData.load_date}
                  onChange={(e) => handleChange('load_date', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', colorScheme: 'light', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <input
                  type="text"
                  value={formData.load_time}
                  onChange={(e) => handleTimeChange('load_time', e.target.value)}
                  placeholder="HH:MM"
                  maxLength={5}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <input
                type="text"
                value={formData.load_coords}
                onChange={(e) => handleChange('load_coords', e.target.value)}
                placeholder="Coordonate (opțional)"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>

            {/* DESCĂRCARE */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: '#ff7a3d', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Descărcare
              </div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  required
                  value={formData.unload_location}
                  onChange={(e) => handleChange('unload_location', e.target.value)}
                  placeholder="Locație completă"
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="date"
                  value={formData.unload_date}
                  onChange={(e) => handleChange('unload_date', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', colorScheme: 'light', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <input
                  type="text"
                  value={formData.unload_time}
                  onChange={(e) => handleTimeChange('unload_time', e.target.value)}
                  placeholder="HH:MM"
                  maxLength={5}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>
              <input
                type="text"
                value={formData.unload_coords}
                onChange={(e) => handleChange('unload_coords', e.target.value)}
                placeholder="Coordonate (opțional)"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
          </div>

          {/* Km & Preț */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Km Gol *</label>
              <input type="number" required min="0" value={formData.km_empty} onChange={(e) => handleChange('km_empty', e.target.value)} placeholder="450" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }} onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Km Plin *</label>
              <input type="number" required min="0" value={formData.km_loaded} onChange={(e) => handleChange('km_loaded', e.target.value)} placeholder="1650" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }} onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Preț (€) *</label>
              <input type="number" required min="0" step="0.01" value={formData.price} onChange={(e) => handleChange('price', e.target.value)} placeholder="2400" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }} onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
          </div>

          {/* Camion & Șoferi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Camion *</label>
              <select
                required
                value={formData.truck}
                onChange={(e) => handleTruckChange(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", cursor: 'pointer' }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              >
                <option value="">Selectează camion...</option>
                {trucks && trucks.map(truck => (
                  <option key={truck.id} value={truck.number}>{truck.number}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>Șoferi *</label>
              <input
                type="text"
                required
                value={formData.drivers}
                onChange={(e) => handleChange('drivers', e.target.value)}
                placeholder="Ion Popescu, Vasile Marin"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>
          </div>

          {/* PDF Upload */}
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="pdf-upload-edit"
              style={{
                display: 'block',
                padding: '24px',
                border: `2px dashed ${pdfFileName ? '#ff7a3d' : 'var(--gray-3)'}`,
                borderRadius: '12px',
                background: pdfFileName ? 'rgba(255, 122, 61, 0.05)' : 'var(--gray-1)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <input id="pdf-upload-edit" type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
              {pdfFileName ? (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ff7a3d', marginBottom: '4px', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    📎 {pdfFileName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    Click pentru a schimba fișierul
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-4)', marginBottom: '4px', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    Comandă de Transport (PDF) — opțional
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    Click pentru a înlocui fișierul existent
                  </div>
                </>
              )}
            </label>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '14px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--black)', cursor: 'pointer', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
              onMouseEnter={(e) => e.target.style.background = 'var(--gray-2)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--gray-1)'}
            >
              Anulează
            </button>
            <button
              type="submit"
              style={{ flex: 1, padding: '14px', background: '#ff7a3d', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
              onMouseEnter={(e) => e.target.style.background = '#ff8c52'}
              onMouseLeave={(e) => e.target.style.background = '#ff7a3d'}
            >
              Salvează Modificările
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditCurseModal;
