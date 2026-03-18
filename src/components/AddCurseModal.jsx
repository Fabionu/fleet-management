import { useState } from 'react';

function AddCurseModal({ trucks, onClose, onSave }) {
  const [formData, setFormData] = useState({
    client: '',
    order_number: '',
    load_firm: '',
    load_street: '',
    load_location: '',
    load_date: '',
    load_time: '',
    load_coords: '',
    unload_firm: '',
    unload_street: '',
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
  const [extraStops, setExtraStops] = useState([]);

  const addExtraStop = () => {
    setExtraStops(prev => [...prev, { type: 'load', firm: '', street: '', location: '', date: '', time: '' }]);
  };
  const updateExtraStop = (index, field, value) => {
    setExtraStops(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };
  const updateExtraStopTime = (index, value) => {
    const digits = value.replace(/\D/g, '');
    let formatted = digits.slice(0, 2);
    if (digits.length >= 3) formatted += ':' + digits.slice(2, 4);
    updateExtraStop(index, 'time', formatted);
  };
  const removeExtraStop = (index) => {
    setExtraStops(prev => prev.filter((_, i) => i !== index));
  };

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

  const [saving, setSaving] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.pdf_file) {
      alert('Comanda de transport (PDF) este obligatorie!');
      return;
    }

    setSaving(true);
    onSave({ ...formData, extraStops });
  };

  const isSaveDisabled = !formData.pdf_file;

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
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '20px', backdropFilter: 'blur(4px)'
      }}
    >
      <div
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)',
          borderRadius: '16px',
          padding: '28px 36px',
          maxWidth: '1100px',
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--gray-2)' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--black)', marginBottom: '2px', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            Adaugă Cursă Nouă
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--gray-4)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            Completează detaliile cursei și încarcă comanda de transport
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Client & Nr. Comandă */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Client *</label>
              <input type="text" required value={formData.client}
                onChange={(e) => handleChange('client', e.target.value)}
                placeholder="Ex: EMEA Transport" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={labelStyle}>Nr. Comandă *</label>
              <input type="text" required value={formData.order_number}
                onChange={(e) => handleChange('order_number', e.target.value)}
                placeholder="Ex: 14557-26" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
          </div>

          {/* Încărcare & Descărcare */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            {/* ÎNCĂRCARE */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', color: '#ff7a3d', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Încărcare
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input type="text" value={formData.load_firm}
                  onChange={(e) => handleChange('load_firm', e.target.value)}
                  placeholder="Nume firmă (ex: METRO AG)" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input type="text" value={formData.load_street}
                  onChange={(e) => handleChange('load_street', e.target.value)}
                  placeholder="Stradă / Zonă industrială" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input type="text" required value={formData.load_location}
                  onChange={(e) => handleChange('load_location', e.target.value)}
                  placeholder="Țară, cod poștal, oraș (ex: DE 40599 Düsseldorf)" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input type="date" required value={formData.load_date}
                  onChange={(e) => handleChange('load_date', e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'light' }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                <input type="text" required value={formData.load_time}
                  onChange={(e) => handleTimeChange('load_time', e.target.value)}
                  placeholder="HH:MM" maxLength={5} style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <input type="text" value={formData.load_coords}
                onChange={(e) => handleChange('load_coords', e.target.value)}
                placeholder="Coord. (opțional)" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>

            {/* DESCĂRCARE */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', color: '#ff7a3d', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Descărcare
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input type="text" value={formData.unload_firm}
                  onChange={(e) => handleChange('unload_firm', e.target.value)}
                  placeholder="Nume firmă (ex: Amazon EU SARL)" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <input type="text" value={formData.unload_street}
                  onChange={(e) => handleChange('unload_street', e.target.value)}
                  placeholder="Stradă / Zonă industrială" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input type="text" required value={formData.unload_location}
                  onChange={(e) => handleChange('unload_location', e.target.value)}
                  placeholder="Țară, cod poștal, oraș (ex: DE 10117 Berlin)" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input type="date" required value={formData.unload_date}
                  onChange={(e) => handleChange('unload_date', e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'light' }}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                <input type="text" required value={formData.unload_time}
                  onChange={(e) => handleTimeChange('unload_time', e.target.value)}
                  placeholder="HH:MM" maxLength={5} style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
              </div>
              <input type="text" value={formData.unload_coords}
                onChange={(e) => handleChange('unload_coords', e.target.value)}
                placeholder="Coord. (opțional)" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
          </div>

          {/* Opriri Suplimentare */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-4)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                Opriri Suplimentare {extraStops.length > 0 && <span style={{ color: '#ff7a3d' }}>({extraStops.length})</span>}
              </div>
              <button type="button" onClick={addExtraStop}
                style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ff7a3d', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#ff7a3d', cursor: 'pointer', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,122,61,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                + Adaugă Oprire
              </button>
            </div>
            {extraStops.map((stop, idx) => (
              <div key={idx} style={{ border: '1px solid var(--gray-2)', borderRadius: '10px', padding: '12px', marginBottom: '10px', background: 'var(--gray-1)' }}>
                {/* Header oprire */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <select value={stop.type} onChange={(e) => updateExtraStop(idx, 'type', e.target.value)}
                    style={{ padding: '5px 10px', border: '1px solid var(--gray-3)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: stop.type === 'load' ? 'rgba(255,122,61,0.08)' : 'rgba(37,99,235,0.08)', color: stop.type === 'load' ? '#ff7a3d' : 'var(--blue)', cursor: 'pointer', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}>
                    <option value="load">Încărcare</option>
                    <option value="unload">Descărcare</option>
                  </select>
                  <button type="button" onClick={() => removeExtraStop(idx)}
                    style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: '6px', cursor: 'pointer', color: 'var(--red)', fontSize: '12px', fontWeight: 500, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                    Elimină
                  </button>
                </div>
                {/* Câmpuri */}
                <div style={{ marginBottom: '8px' }}>
                  <input type="text" value={stop.firm} onChange={(e) => updateExtraStop(idx, 'firm', e.target.value)}
                    placeholder="Nume firmă (ex: METRO AG)" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <input type="text" value={stop.street} onChange={(e) => updateExtraStop(idx, 'street', e.target.value)}
                    placeholder="Stradă / Zonă industrială" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <input type="text" required value={stop.location} onChange={(e) => updateExtraStop(idx, 'location', e.target.value)}
                    placeholder="Țară, cod poștal, oraș (ex: DE 40599 Düsseldorf)" style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="date" value={stop.date} onChange={(e) => updateExtraStop(idx, 'date', e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'light' }}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                  <input type="text" value={stop.time} onChange={(e) => updateExtraStopTime(idx, e.target.value)}
                    placeholder="HH:MM" maxLength={5} style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#ff7a3d'} onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
                </div>
              </div>
            ))}
          </div>

          {/* Km Gol | Km Plin | Preț | Camion | Șoferi — un singur rând */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Km Gol *</label>
              <input type="number" required min="0" value={formData.km_empty}
                onChange={(e) => handleChange('km_empty', e.target.value)}
                placeholder="450" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={labelStyle}>Km Plin *</label>
              <input type="number" required min="0" value={formData.km_loaded}
                onChange={(e) => handleChange('km_loaded', e.target.value)}
                placeholder="1650" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={labelStyle}>Preț (€) *</label>
              <input type="number" required min="0" step="0.01" value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="2400" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
            <div>
              <label style={labelStyle}>Camion *</label>
              <select required value={formData.truck} onChange={(e) => handleTruckChange(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'}>
                <option value="">Selectează...</option>
                {trucks && trucks.map(truck => (
                  <option key={truck.id} value={truck.number}>{truck.number}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Șoferi *</label>
              <input type="text" required value={formData.drivers}
                onChange={(e) => handleChange('drivers', e.target.value)}
                placeholder="Ion Popescu, Vasile Marin" style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#ff7a3d'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gray-3)'} />
            </div>
          </div>

          {/* PDF Upload — orizontal compact */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="pdf-upload"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                padding: '12px 20px',
                border: `2px dashed ${pdfFileName ? '#ff7a3d' : 'var(--gray-3)'}`,
                borderRadius: '10px',
                background: pdfFileName ? 'rgba(255, 122, 61, 0.05)' : 'var(--gray-1)',
                cursor: 'pointer', transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => { if (!pdfFileName) { e.currentTarget.style.borderColor = '#ff7a3d'; e.currentTarget.style.background = 'rgba(255, 122, 61, 0.02)'; } }}
              onMouseLeave={(e) => { if (!pdfFileName) { e.currentTarget.style.borderColor = 'var(--gray-3)'; e.currentTarget.style.background = 'var(--gray-1)'; } }}
            >
              <input id="pdf-upload" type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
              {!pdfFileName ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              )}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: pdfFileName ? '#22c55e' : '#ff7a3d', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {pdfFileName ? `✓ ${pdfFileName}` : 'Comandă de Transport (PDF) *'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gray-4)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  {pdfFileName ? 'Click pentru a schimba fișierul' : 'Click pentru a încărca fișierul'}
                </div>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px', background: 'var(--gray-1)', border: '1px solid var(--gray-3)', borderRadius: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--black)', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gray-1)'}>
              Anulează
            </button>
            <button type="submit" disabled={isSaveDisabled || saving}
              style={{ flex: 1, padding: '10px', background: (isSaveDisabled || saving) ? 'var(--gray-3)' : '#ff7a3d', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: (isSaveDisabled || saving) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: (isSaveDisabled || saving) ? 0.7 : 1, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onMouseEnter={(e) => { if (!isSaveDisabled && !saving) e.currentTarget.style.background = '#ff8c52'; }}
              onMouseLeave={(e) => { if (!isSaveDisabled && !saving) e.currentTarget.style.background = '#ff7a3d'; }}>
              {saving && <svg style={{ animation: 'spin-loader 0.8s linear infinite', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
              {saving ? 'Se salvează...' : 'Salvează Cursă'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCurseModal;
