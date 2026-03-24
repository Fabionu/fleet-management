import { useState, useRef, useCallback } from 'react';

const EMPTY = {
  order_number: '', client: '',
  load_date: '', load_time: '',
  load_company: '', load_street: '', load_city: '',
  load_coords: '', load_details: '', load_ref: '',
  unload_date: '', unload_time: '',
  unload_company: '', unload_street: '', unload_city: '',
  unload_coords: '', unload_ref: '',
};

function buildWhatsApp(f) {
  const coordInc   = f.load_coords   ? `NORD - EST ${f.load_coords}`   : 'NORD - EST __________, __________';
  const coordDesc  = f.unload_coords ? `NORD - EST ${f.unload_coords}` : 'NORD - EST __________, __________';

  const loadAddr   = [f.load_company,   f.load_street,   f.load_city  ].filter(Boolean).join('\n') || '___________';
  const unloadAddr = [f.unload_company, f.unload_street, f.unload_city].filter(Boolean).join('\n') || '___________';

  const lines = [
    `*•NUMĂR COMANDĂ:* ${f.order_number || '___________'}`,
    `*•NUME CLIENT:* ${f.client || '___________'}`,
    ``,
    `*•ÎNCĂRCARE ${f.load_date || '___'}, LA ORA ${f.load_time || '___'}, LA ADRESA:*`,
    ``,
    loadAddr,
    ``,
    `*•COORDONATE INCARCARE:*`,
    coordInc,
    ``,
    `*•DETALII INCARCARE:*${f.load_details ? ' ' + f.load_details : ''}`,
    f.load_ref ? `*•REFERINTA:* ${f.load_ref}` : null,
    ``,
    `*•DESCARCARE ${f.unload_date || '___'}, LA ORA ${f.unload_time || '___'}, LA ADRESA:*`,
    ``,
    unloadAddr,
    ``,
    `*•COORDONATE DESCARCARE:*`,
    coordDesc,
    f.unload_ref ? `\n*•REFERINTA:* ${f.unload_ref}` : null,
  ].filter(l => l !== null);

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
        const token = localStorage.getItem('authToken');
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

  const handleCopy = () => {
    navigator.clipboard.writeText(buildWhatsApp(fields)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => { setFields(EMPTY); setFileName(''); setError(''); };

  const previewLines = buildWhatsApp(fields).split('\n');

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

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px', alignItems: 'start' }}>

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

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: '12px', padding: '16px' }}>

            {/* Număr comandă + Client */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Număr comandă" value={fields.order_number} onChange={set('order_number')} />
              <Field label="Client" value={fields.client} onChange={set('client')} />
            </div>

            {/* Încărcare | Descărcare — flat CSS grid, fiecare rând se aliniază automat */}
            <div style={{ borderTop: '1px solid var(--gray-1)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>

              {/* Rând 1 — etichete secțiuni */}
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff7a3d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Încărcare</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff7a3d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Descărcare</div>

              {/* Rând 2 — Dată + Oră */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Field label="Dată" value={fields.load_date} onChange={set('load_date')} placeholder="DD.MM.YYYY" />
                <Field label="Oră" value={fields.load_time} onChange={set('load_time')} placeholder="HH:MM" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Field label="Dată" value={fields.unload_date} onChange={set('unload_date')} placeholder="DD.MM.YYYY" />
                <Field label="Oră" value={fields.unload_time} onChange={set('unload_time')} placeholder="HH:MM" />
              </div>

              {/* Rând 3 — Nume firmă */}
              <Field label="Nume firmă" value={fields.load_company} onChange={set('load_company')} placeholder="ex: MUBEA PROSTEJOV" />
              <Field label="Nume firmă" value={fields.unload_company} onChange={set('unload_company')} placeholder="ex: ILN MIOVENI" />

              {/* Rând 4 — Stradă */}
              <Field label="Stradă / Nr. / Zonă industrială" value={fields.load_street} onChange={set('load_street')} placeholder="ex: ROVNA 4708" />
              <Field label="Stradă / Nr. / Zonă industrială" value={fields.unload_street} onChange={set('unload_street')} placeholder="ex: 148 BLD DACIA NR" />

              {/* Rând 5 — Țară, cod, oraș */}
              <Field label="Țară, Cod poștal, Oraș" value={fields.load_city} onChange={set('load_city')} placeholder="ex: CZ, 796 01 PROSTEJOV" />
              <Field label="Țară, Cod poștal, Oraș" value={fields.unload_city} onChange={set('unload_city')} placeholder="ex: RO, 115400 MIOVENI" />

              {/* Rând 6 — Coordonate */}
              <Field label="Coordonate (Lat, Long)" value={fields.load_coords} onChange={set('load_coords')} placeholder="47.123456, 27.123456" />
              <Field label="Coordonate (Lat, Long)" value={fields.unload_coords} onChange={set('unload_coords')} placeholder="47.123456, 27.123456" />

              {/* Rând 7 — Detalii marfă (stânga) / gol dreapta — rândul se înalță automat cu textarea */}
              <Field label="Detalii marfă / Tonaj" value={fields.load_details} onChange={set('load_details')} multiline />
              <div />

              {/* Rând 8 — Referință (aliniate perfect datorită CSS grid) */}
              <Field label="Referință încărcare" value={fields.load_ref} onChange={set('load_ref')} />
              <Field label="Referință descărcare" value={fields.unload_ref} onChange={set('unload_ref')} />

            </div>

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

            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--black)' }}>Preview comandă</span>
              <button onClick={handleCopy}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', border: '1px solid var(--gray-3)', borderRadius: '6px', background: copied ? 'var(--green)' : 'transparent', cursor: 'pointer', fontSize: '12px', color: copied ? 'white' : 'var(--black)', fontFamily: 'inherit', transition: 'all 0.15s', fontWeight: 500 }}>
                {copied ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiat!</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Copiază WhatsApp</>
                )}
              </button>
            </div>

            {/* Preview text */}
            <div style={{ padding: '20px 24px', background: 'var(--surface)', minHeight: '200px' }}>
              {previewLines.map((line, i) => {
                if (line === '') return <div key={i} style={{ height: '0.8em' }} />;
                // Orice linie care începe cu *• este bold (label sau label + valoare)
                const boldMatch = line.match(/^\*•(.*?)\*(.*)$/);
                if (boldMatch) {
                  const label = '•' + boldMatch[1];
                  const rest = boldMatch[2].trim();
                  return (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--black)', fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
                      <strong>{label}</strong>{rest ? ' ' + rest : ''}
                    </div>
                  );
                }
                return <div key={i} style={{ fontSize: '13px', color: 'var(--gray-4)', fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>{line}</div>;
              })}
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '10px', fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--black)', fontWeight: 600 }}>Cum funcționează:</strong><br/>
            1. Încarcă PDF-ul comenzii de transport<br/>
            2. AI-ul extrage automat câmpurile<br/>
            3. Verifică și corectează dacă e necesar<br/>
            4. Copiază textul formatat pentru WhatsApp
          </div>
        </div>
      </div>
    </div>
  );
}
