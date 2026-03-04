import { useState } from 'react';

function AddCurseModal({ trucks, onClose, onSave }) {
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
    km_empty: '',
    km_loaded: '',
    price: '',
    truck: '',
    drivers: '',
    pdf_file: null
  });

  const [pdfFileName, setPdfFileName] = useState('');

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
      drivers: selectedTruck?.drivers || ''
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
    
    if (!formData.pdf_file) {
      alert('Comanda de transport (PDF) este obligatorie!');
      return;
    }
    
    onSave(formData);
  };

  const isSaveDisabled = !formData.pdf_file;

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
            Adaugă Cursă Nouă
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--gray-4)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Completează detaliile cursei și încarcă comanda de transport
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
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Client *
              </label>
              <input
                type="text"
                required
                value={formData.client}
                onChange={(e) => handleChange('client', e.target.value)}
                placeholder="Ex: EMEA Transport"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Nr. Comandă *
              </label>
              <input
                type="text"
                required
                value={formData.order_number}
                onChange={(e) => handleChange('order_number', e.target.value)}
                placeholder="Ex: 14557-26"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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

          {/* Încărcare & Descărcare - Side by Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* ÎNCĂRCARE */}
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                color: '#ff7a3d',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Încărcare
              </div>

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  required
                  value={formData.load_location}
                  onChange={(e) => handleChange('load_location', e.target.value)}
                  placeholder="Locație completă (ex: Strada Aviatorilor 42, București, România)"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="date"
                  required
                  value={formData.load_date}
                  onChange={(e) => handleChange('load_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    colorScheme: 'light',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <input
                  type="text"
                  required
                  value={formData.load_time}
                  onChange={(e) => handleTimeChange('load_time', e.target.value)}
                  placeholder="HH:MM"
                  maxLength={5}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>

              <input
                type="text"
                value={formData.load_coords}
                onChange={(e) => handleChange('load_coords', e.target.value)}
                placeholder="Coordonate (opțional)"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'var(--bg-page)',
                  color: 'var(--black)',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              />
            </div>

            {/* DESCĂRCARE */}
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                color: '#ff7a3d',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Descărcare
              </div>

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  required
                  value={formData.unload_location}
                  onChange={(e) => handleChange('unload_location', e.target.value)}
                  placeholder="Locație completă (ex: Unter den Linden 77, Berlin, Germania)"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="date"
                  required
                  value={formData.unload_date}
                  onChange={(e) => handleChange('unload_date', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    colorScheme: 'light',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
                <input
                  type="text"
                  required
                  value={formData.unload_time}
                  onChange={(e) => handleTimeChange('unload_time', e.target.value)}
                  placeholder="HH:MM"
                  maxLength={5}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--gray-3)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--bg-page)',
                    color: 'var(--black)',
                    outline: 'none',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
                />
              </div>

              <input
                type="text"
                value={formData.unload_coords}
                onChange={(e) => handleChange('unload_coords', e.target.value)}
                placeholder="Coordonate (opțional)"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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

          {/* Km & Preț */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Km Gol *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.km_empty}
                onChange={(e) => handleChange('km_empty', e.target.value)}
                placeholder="450"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Km Plin *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.km_loaded}
                onChange={(e) => handleChange('km_loaded', e.target.value)}
                placeholder="1650"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Preț (€) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="2400"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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

          {/* Camion & Șoferi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Camion *
              </label>
              <select
                required
                value={formData.truck}
                onChange={(e) => handleTruckChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'var(--bg-page)',
                  color: 'var(--black)',
                  outline: 'none',
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  cursor: 'pointer'
                }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}
              >
                <option value="">Selectează camion...</option>
                {trucks && trucks.map(truck => (
                  <option key={truck.id} value={truck.number}>
                    {truck.number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '6px',
                color: 'var(--black)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}>
                Șoferi *
              </label>
              <input
                type="text"
                required
                value={formData.drivers}
                onChange={(e) => handleChange('drivers', e.target.value)}
                placeholder="Ion Popescu, Vasile Marin"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--gray-3)',
                  borderRadius: '6px',
                  fontSize: '13px',
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

          {/* PDF Upload */}
          <div style={{ marginBottom: '24px' }}>
            <label 
              htmlFor="pdf-upload"
              style={{
                display: 'block',
                padding: '32px 24px',
                border: `2px dashed ${pdfFileName ? '#ff7a3d' : 'var(--gray-3)'}`,
                borderRadius: '12px',
                background: pdfFileName ? 'rgba(255, 122, 61, 0.05)' : 'var(--gray-1)',
                cursor: 'pointer',
                transition: 'all 0.3s',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                if (!pdfFileName) {
                  e.target.style.borderColor = '#ff7a3d';
                  e.target.style.background = 'rgba(255, 122, 61, 0.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (!pdfFileName) {
                  e.target.style.borderColor = 'var(--gray-3)';
                  e.target.style.background = 'var(--gray-1)';
                }
              }}
            >
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                style={{ display: 'none' }}
              />
              
              {!pdfFileName ? (
                <>
                  <svg 
                    width="48" 
                    height="48" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#ff7a3d" 
                    strokeWidth="2"
                    style={{ margin: '0 auto 12px', display: 'block' }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ff7a3d',
                    marginBottom: '4px',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}>
                    Comandă de Transport (PDF) *
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--gray-4)',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}>
                    Click pentru a încărca sau trage fișierul aici
                  </div>
                </>
              ) : (
                <>
                  <svg 
                    width="48" 
                    height="48" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#22c55e" 
                    strokeWidth="2"
                    style={{ margin: '0 auto 12px', display: 'block' }}
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#22c55e',
                    marginBottom: '4px',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}>
                    ✓ {pdfFileName}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--gray-4)',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}>
                    Click pentru a schimba fișierul
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
              disabled={isSaveDisabled}
              style={{
                flex: 1,
                padding: '14px',
                background: isSaveDisabled ? 'var(--gray-3)' : '#ff7a3d',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isSaveDisabled ? 0.5 : 1,
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
              onMouseEnter={(e) => {
                if (!isSaveDisabled) e.target.style.background = '#ff8c52';
              }}
              onMouseLeave={(e) => {
                if (!isSaveDisabled) e.target.style.background = '#ff7a3d';
              }}
            >
              Salvează Cursă
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCurseModal;
