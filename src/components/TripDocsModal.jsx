import { useState, useRef } from 'react';

const DOC_TYPES = [
  {
    key: 'comanda',
    label: 'Comanda de Transport',
    dataKey: 'file_data',
    nameKey: 'file_name',
    typeKey: 'file_type',
  },
  {
    key: 'cmr',
    label: 'CMR',
    dataKey: 'cmr_file_data',
    nameKey: 'cmr_file_name',
    typeKey: 'cmr_file_type',
  },
  {
    key: 'factura',
    label: 'Factură',
    dataKey: 'invoice_file_data',
    nameKey: 'invoice_file_name',
    typeKey: 'invoice_file_type',
  },
];

function TripDocsModal({ trip, onClose, onSave }) {
  const [docs, setDocs] = useState({
    file_data: trip.file_data || null,
    file_name: trip.file_name || null,
    file_type: trip.file_type || null,
    cmr_file_data: trip.cmr_file_data || null,
    cmr_file_name: trip.cmr_file_name || null,
    cmr_file_type: trip.cmr_file_type || null,
    invoice_file_data: trip.invoice_file_data || null,
    invoice_file_name: trip.invoice_file_name || null,
    invoice_file_type: trip.invoice_file_type || null,
  });

  const [selectedDoc, setSelectedDoc] = useState(() => {
    if (trip.file_data) return 'comanda';
    if (trip.cmr_file_data) return 'cmr';
    if (trip.invoice_file_data) return 'factura';
    return null;
  });

  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef({});

  const handleFileUpload = (docKey, file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Te rog să încarci un fișier PDF valid!');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const docDef = DOC_TYPES.find(d => d.key === docKey);
      setDocs(prev => ({
        ...prev,
        [docDef.dataKey]: ev.target.result,
        [docDef.nameKey]: file.name,
        [docDef.typeKey]: file.type,
      }));
      setSelectedDoc(docKey);
      setChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDoc = (docKey) => {
    const docDef = DOC_TYPES.find(d => d.key === docKey);
    setDocs(prev => ({
      ...prev,
      [docDef.dataKey]: null,
      [docDef.nameKey]: null,
      [docDef.typeKey]: null,
    }));
    if (selectedDoc === docKey) setSelectedDoc(null);
    setChanged(true);
  };

  const handleSave = async () => {
    if (!changed) { onClose(); return; }
    setSaving(true);
    try {
      await onSave(docs, trip.id);
    } finally {
      setSaving(false);
    }
  };

  const selectedDocDef = DOC_TYPES.find(d => d.key === selectedDoc);
  const previewData = selectedDocDef ? docs[selectedDocDef.dataKey] : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, backdropFilter: 'blur(4px)', padding: '20px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--gray-2)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '1500px',
          width: '100%',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--gray-2)',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '20px', fontWeight: 600, color: 'var(--black)', marginBottom: '4px',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            Documente Cursă
          </h2>
          <p style={{
            fontSize: '13px', color: 'var(--gray-4)',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            {trip.client} — {trip.order_number}
          </p>
        </div>

        {/* Body: stânga carduri + dreapta preview */}
        <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>

          {/* Stânga: carduri documente */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '240px', flexShrink: 0 }}>
            {DOC_TYPES.map(docType => {
              const hasDoc = !!docs[docType.dataKey];
              const isSelected = selectedDoc === docType.key;

              return (
                <div
                  key={docType.key}
                  onClick={() => { if (hasDoc) setSelectedDoc(isSelected ? null : docType.key); }}
                  style={{
                    border: `2px solid ${isSelected ? '#ff7a3d' : hasDoc ? '#22c55e' : 'var(--gray-3)'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    background: isSelected
                      ? 'rgba(255,122,61,0.05)'
                      : hasDoc ? 'rgba(34,197,94,0.03)' : 'var(--gray-1)',
                    transition: 'all 0.15s',
                    cursor: hasDoc ? 'pointer' : 'default',
                  }}
                >
                  {/* Input ascuns */}
                  <input
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    ref={el => fileRefs.current[docType.key] = el}
                    onChange={e => {
                      if (e.target.files[0]) {
                        handleFileUpload(docType.key, e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />

                  {/* Titlu + indicator dot */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '13px', fontWeight: 600, color: 'var(--black)',
                      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                    }}>
                      {docType.label}
                    </span>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: hasDoc ? '#22c55e' : 'var(--gray-3)',
                      flexShrink: 0
                    }} />
                  </div>

                  {/* Filename sau lipsă */}
                  <div style={{
                    fontSize: '11px',
                    color: hasDoc ? 'var(--black)' : 'var(--gray-4)',
                    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                    marginBottom: '12px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    opacity: hasDoc ? 0.8 : 0.6,
                  }}>
                    {hasDoc ? docs[docType.nameKey] : 'Niciun document adăugat'}
                  </div>

                  {/* Butoane acțiuni */}
                  {hasDoc ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Înlocuiește */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          fileRefs.current[docType.key]?.click();
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          background: 'transparent',
                          border: '1px solid var(--gray-3)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--gray-4)',
                          cursor: 'pointer',
                          fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Înlocuiește
                      </button>
                      {/* Șterge */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteDoc(docType.key);
                        }}
                        title="Șterge document"
                        style={{
                          padding: '7px 10px',
                          background: 'transparent',
                          border: '1px solid var(--gray-3)',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                          e.currentTarget.style.borderColor = '#ef4444';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'var(--gray-3)';
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        fileRefs.current[docType.key]?.click();
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 12px',
                        background: '#ff7a3d',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'white',
                        cursor: 'pointer',
                        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#ff8c52'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ff7a3d'}
                    >
                      + Adaugă document
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dreapta: preview */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {previewData ? (
              <>
                <div style={{
                  fontSize: '12px', color: 'var(--gray-4)', marginBottom: '8px', flexShrink: 0,
                  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                }}>
                  {selectedDocDef?.label} —{' '}
                  <span style={{ color: 'var(--black)' }}>{docs[selectedDocDef?.nameKey]}</span>
                </div>
                {/* key={selectedDoc} forțează re-montarea iframe la schimbarea documentului */}
                <iframe
                  key={selectedDoc}
                  src={previewData}
                  style={{
                    flex: 1,
                    width: '100%',
                    border: '1px solid var(--gray-2)',
                    borderRadius: '8px',
                  }}
                  title={`Preview ${selectedDocDef?.label}`}
                />
              </>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '2px dashed var(--gray-2)', borderRadius: '12px',
                color: 'var(--gray-4)',
                fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
              }}>
                <svg
                  width="52" height="52" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1"
                  style={{ opacity: 0.25, marginBottom: '16px' }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                  {DOC_TYPES.some(d => docs[d.dataKey])
                    ? 'Selectează un document pentru preview'
                    : 'Niciun document adăugat încă'}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>
                  {DOC_TYPES.some(d => docs[d.dataKey])
                    ? 'Apasă pe un card din stânga'
                    : 'Folosește butoanele din stânga pentru a adăuga'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '12px',
          marginTop: '20px', paddingTop: '20px',
          borderTop: '1px solid var(--gray-2)', flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '14px',
              background: 'var(--gray-1)', border: '1px solid var(--gray-3)',
              borderRadius: '8px', fontSize: '14px', fontWeight: 500,
              color: 'var(--black)', cursor: 'pointer',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '14px',
              background: changed ? '#ff7a3d' : 'var(--gray-2)',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              color: changed ? 'white' : 'var(--gray-4)',
              cursor: saving ? 'not-allowed' : changed ? 'pointer' : 'default',
              fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
              transition: 'background 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (changed && !saving) e.currentTarget.style.background = '#ff8c52'; }}
            onMouseLeave={e => { if (changed && !saving) e.currentTarget.style.background = '#ff7a3d'; }}
          >
            {saving ? 'Se salvează...' : changed ? 'Salvează Modificările' : 'Nicio modificare'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TripDocsModal;
