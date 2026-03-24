import { useState, useRef, useCallback } from 'react';

const EMPTY = {
  order_number: '', client: '',
  load_date: '', load_time: '', load_address: '', load_lat: '', load_lng: '',
  load_details: '', load_ref: '',
  unload_date: '', unload_time: '', unload_address: '', unload_lat: '', unload_lng: '',
  unload_ref: '',
};

function buildTemplate(f) {
  const coordInc = (f.load_lat || f.load_lng)
    ? `NORD - EST ${f.load_lat || '___'}, ${f.load_lng || '___'}`
    : 'NORD - EST ___, ___';
  const coordDesc = (f.unload_lat || f.unload_lng)
    ? `NORD - EST ${f.unload_lat || '___'}, ${f.unload_lng || '___'}`
    : 'NORD - EST ___, ___';

  const lines = [
    `•NUMĂR COMANDĂ: ${f.order_number || '___'}`,
    `•NUME CLIENT: ${f.client || '___'}`,
    `•ÎNCĂRCARE ${f.load_date || '___'}, LA ORA ${f.load_time || '___'}, LA ADRESA: ${f.load_address || '___'}`,
    `•COORDONATE INCARCARE: ${coordInc}`,
    `•DETALII INCARCARE: ${f.load_details || ''}`,
    f.load_ref ? `•REFERINTA INCARCARE: ${f.load_ref}` : null,
    `•DESCARCARE ${f.unload_date || '___'}, LA ORA ${f.unload_time || '___'}, LA ADRESA: ${f.unload_address || '___'}`,
    `•COORDONATE DESCARCARE: ${coordDesc}`,
    f.unload_ref ? `•REFERINTA DESCARCARE: ${f.unload_ref}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

function buildWhatsApp(f) {
  const coordInc = (f.load_lat || f.load_lng)
    ? `NORD - EST ${f.load_lat || '___'}, ${f.load_lng || '___'}`
    : 'NORD - EST ___, ___';
  const coordDesc = (f.unload_lat || f.unload_lng)
    ? `NORD - EST ${f.unload_lat || '___'}, ${f.unload_lng || '___'}`
    : 'NORD - EST ___, ___';

  const lines = [
    `*•NUMĂR COMANDĂ:* ${f.order_number || '___'}`,
    `*•NUME CLIENT:* ${f.client || '___'}`,
    `*•ÎNCĂRCARE ${f.load_date || '___'}, LA ORA ${f.load_time || '___'}, LA ADRESA:* ${f.load_address || '___'}`,
    `*•COORDONATE INCARCARE:* ${coordInc}`,
    `*•DETALII INCARCARE:* ${f.load_details || ''}`,
    f.load_ref ? `*•REFERINTA INCARCARE:* ${f.load_ref}` : null,
    `*•DESCARCARE ${f.unload_date || '___'}, LA ORA ${f.unload_time || '___'}, LA ADRESA:* ${f.unload_address || '___'}`,
    `*•COORDONATE DESCARCARE:* ${coordDesc}`,
    f.unload_ref ? `*•REFERINTA DESCARCARE:* ${f.unload_ref}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', fontSize: '13px',
  border: '1px solid var(--gray-2)', borderRadius: '8px',
  background: 'var(--gray-1)', color: 'var(--black)',
  outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
};

const labelStyle = {
  fontSize: '11px', fontWeight: 600,
  color: 'var(--gray-4)', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: '4px', display: 'block',
};

function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}</label>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e => e.target.style.borderColor = 'var(--gray-2)'}
        />
      ) : (
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e => e.target.style.borderColor = 'var(--gray-2)'}
        />
      )}
    </div>
  );
}

export default function GenerareComanda({ user }) {
  const [fields, setFields] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef();

  const set = (key) => (val) => setFields(f => ({ ...f, [key]: val }));

  const processFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Te rog selectează un fișier PDF valid.');
      return;
    }
    setFileName(file.name);
    setError('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1];
        const token = localStorage.getItem('token');
        const res = await fetch('/api/extract-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pdfBase64: base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Eroare server');
        setFields({ ...EMPTY, ...json.data });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleCopy = (whatsapp) => {
    const text = whatsapp ? buildWhatsApp(fields) : buildTemplate(fields);
    navigator.clipboard.writeText(text).then(() => {
      if (whatsapp) { setCopiedWA(true); setTimeout(() => setCopiedWA(false), 2000); }
      else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    });
  };

  const handleReset = () => { setFields(EMPTY); setFileName(''); setError(''); };

  const templateText = buildTemplate(fields);

  return (
    <div style={{ paddingTop: '24px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--black)', margin: 0, letterSpacing: '-0.02em' }}>
          Generare Comandă
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--gray-4)', marginTop: '4px' }}>
          Încarcă un PDF cu comanda de transport și AI-ul va completa automat câmpurile.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* LEFT — Upload + Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Drop zone */}
          <div
            onClick={() => !loading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: dragOver ? '2px dashed #ff7a3d' : '2px dashed var(--gray-3)',
              borderRadius: '12px', padding: '32px 20px',
              textAlign: 'center', cursor: loading ? 'default' : 'pointer',
              background: dragOver ? 'rgba(255,122,61,0.04)' : 'var(--gray-1)',
              transition: 'all 0.15s',
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <svg style={{ animation: 'spin-loader 0.8s linear infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}>AI procesează PDF-ul...</span>
              </div>
            ) : fileName ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <polyline points="9 15 11 17 15 13"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>{fileName}</span>
                <span style={{ fontSize: '11px', color: 'var(--gray-4)' }}>Click pentru a înlocui</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <span style={{ fontSize: '13px', color: 'var(--gray-4)' }}>
                  <span style={{ color: '#ff7a3d', fontWeight: 600 }}>Click</span> sau trage un PDF aici
                </span>
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: '8px', fontSize: '13px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {/* Fields grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '12px', padding: '16px' }}>

            {/* General */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Număr comandă" value={fields.order_number} onChange={set('order_number')} />
              <Field label="Client" value={fields.client} onChange={set('client')} />
            </div>

            {/* Separator */}
            <div style={{ borderTop: '1px solid var(--gray-1)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff7a3d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Încărcare
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Field label="Dată" value={fields.load_date} onChange={set('load_date')} placeholder="DD.MM.YYYY" />
                  <Field label="Oră" value={fields.load_time} onChange={set('load_time')} placeholder="HH:MM" />
                </div>
                <Field label="Adresă" value={fields.load_address} onChange={set('load_address')} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Field label="Latitudine (Nord)" value={fields.load_lat} onChange={set('load_lat')} placeholder="ex: 47.123456" />
                  <Field label="Longitudine (Est)" value={fields.load_lng} onChange={set('load_lng')} placeholder="ex: 27.123456" />
                </div>
                <Field label="Detalii marfă" value={fields.load_details} onChange={set('load_details')} multiline />
                <Field label="Referință încărcare" value={fields.load_ref} onChange={set('load_ref')} />
              </div>
            </div>

            {/* Descarcare */}
            <div style={{ borderTop: '1px solid var(--gray-1)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Descărcare
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Field label="Dată" value={fields.unload_date} onChange={set('unload_date')} placeholder="DD.MM.YYYY" />
                  <Field label="Oră" value={fields.unload_time} onChange={set('unload_time')} placeholder="HH:MM" />
                </div>
                <Field label="Adresă" value={fields.unload_address} onChange={set('unload_address')} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Field label="Latitudine (Nord)" value={fields.unload_lat} onChange={set('unload_lat')} placeholder="ex: 47.123456" />
                  <Field label="Longitudine (Est)" value={fields.unload_lng} onChange={set('unload_lng')} placeholder="ex: 27.123456" />
                </div>
                <Field label="Referință descărcare" value={fields.unload_ref} onChange={set('unload_ref')} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button onClick={handleReset}
                style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: '8px', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--gray-4)', fontFamily: 'inherit', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                Resetează
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '12px', overflow: 'hidden' }}>

            {/* Header preview */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>Preview comandă</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleCopy(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', border: '1px solid var(--gray-3)', borderRadius: '6px', background: copied ? 'var(--green)' : 'transparent', cursor: 'pointer', fontSize: '12px', color: copied ? 'white' : 'var(--black)', fontFamily: 'inherit', transition: 'all 0.15s', fontWeight: 500 }}>
                  {copied ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat!</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiază</>
                  )}
                </button>
                <button onClick={() => handleCopy(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', border: '1px solid var(--gray-3)', borderRadius: '6px', background: copiedWA ? '#25D366' : 'transparent', cursor: 'pointer', fontSize: '12px', color: copiedWA ? 'white' : 'var(--black)', fontFamily: 'inherit', transition: 'all 0.15s', fontWeight: 500 }}>
                  {copiedWA ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat!</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg> WhatsApp</>
                  )}
                </button>
              </div>
            </div>

            {/* Template text */}
            <pre style={{
              margin: 0, padding: '16px',
              fontSize: '13px', lineHeight: '1.8',
              color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: 'var(--surface)',
              minHeight: '200px',
            }}>
              {templateText.split('\n').map((line, i) => {
                // Bold the bullet labels
                const match = line.match(/^(•[^:]+:)\s*(.*)/);
                if (match) {
                  return (
                    <span key={i}>
                      <span style={{ fontWeight: 700, color: 'var(--black)' }}>{match[1]}</span>
                      {' '}<span style={{ color: match[2] ? 'var(--black)' : 'var(--gray-3)' }}>{match[2] || '___'}</span>
                      {'\n'}
                    </span>
                  );
                }
                return <span key={i}>{line}{'\n'}</span>;
              })}
            </pre>
          </div>

          {/* Info card */}
          <div style={{ padding: '12px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '10px', fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--black)', fontWeight: 600 }}>Cum funcționează:</strong><br/>
            1. Încarcă PDF-ul comenzii de transport<br/>
            2. AI-ul extrage automat câmpurile<br/>
            3. Verifică și corectează dacă e necesar<br/>
            4. Copiază textul pentru WhatsApp sau plain text
          </div>
        </div>
      </div>
    </div>
  );
}
