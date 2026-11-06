import { makeAddrKey, useCoordsCache, WhatsAppBubble } from './generareShared';

// Varianta „Design Apple” a paginii Generare comandă (HIG web: inset grouped lists, pills, un singur buton principal)
const AFONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif";

const card  = { background: 'var(--ap-card)', borderRadius: '18px', boxShadow: 'var(--ap-shadow)' };
const group = { background: 'var(--ap-fill)', borderRadius: '12px', paddingLeft: '14px' };
const pill  = (bg, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', padding: '0 16px',
  border: 'none', borderRadius: '999px', background: bg, color, fontFamily: 'inherit',
  fontSize: '15px', fontWeight: 500, cursor: 'pointer',
});
const rowInput = {
  flex: 1, minWidth: 0, padding: '12px 0', border: 'none', outline: 'none', background: 'transparent',
  fontFamily: 'inherit', color: 'var(--ap-text)', textAlign: 'right',
};
const iconBtn = {
  // hover: .ap-icon-btn în app.css
  width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: '50%', background: 'var(--ap-fill)', cursor: 'pointer', padding: 0,
};

const STOP_META = {
  incarcare:  { label: 'Încărcare',  color: 'var(--ap-green)',  tint: 'var(--ap-green-tint)',  add: 'Adaugă încărcare' },
  descarcare: { label: 'Descărcare', color: 'var(--ap-orange)', tint: 'var(--ap-orange-tint)', add: 'Adaugă descărcare' },
  vama:       { label: 'Vamă',       color: 'var(--ap-blue)',   tint: 'var(--ap-blue-tint)',   add: 'Adaugă vamă' },
};

const Svg = ({ size = 16, sw = 1.8, children }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IconCopy  = () => <Svg><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>;
const IconCheck = () => <Svg sw={2.4}><path d="M20 6L9 17l-5-5"/></Svg>;
const IconPin   = () => <Svg><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></Svg>;
const IconSave  = () => <Svg><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Svg>;

function Row({ id, label, value, onChange, placeholder, first, labelWidth = 120, size = 15, className = '' }) {
  return (
    <div className={`ap-row ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '46px', paddingRight: '14px', borderTop: first ? 'none' : '0.5px solid var(--ap-sep)' }}>
      <label htmlFor={id} style={{ flex: `0 0 ${labelWidth}px`, fontSize: `${size}px` }}>{label}</label>
      <input id={id} className="ap-input" type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...rowInput, fontSize: `${size}px` }} />
    </div>
  );
}

function ActionRow({ onClick, color = 'var(--ap-accent)', disabled, className = '', children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`ap-action ${className}`}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '46px', padding: '0 14px 0 0', border: 'none', borderTop: '0.5px solid var(--ap-sep)', background: 'transparent', color, fontFamily: 'inherit', fontSize: '15px', textAlign: 'left', cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

function SavedRow() {
  return (
    <div role="status" className="ap-action ap-saved ap-just-saved"
      style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '46px', padding: '0 14px 0 0', borderTop: '0.5px solid var(--ap-sep)', color: 'var(--ap-green)', fontSize: '15px', fontWeight: 600 }}>
      <span className="ap-js-fill" aria-hidden="true" />
      <span className="ap-js-badge" aria-hidden="true" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--ap-green)', color: 'var(--ap-on-green)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path className="ap-tick" d="M20 6L9 17l-5-5"/></svg>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <span key={a} className="ap-spark" style={{ '--a': `${a}deg` }} />)}
      </span>
      <span className="ap-js-text" style={{ position: 'relative' }}>Coordonate salvate</span>
    </div>
  );
}

function AppleStop({ stop, idx, total, onUpdate, onMove, onDelete, canDelete, onChangeType, copiedId, onCopyAddr }) {
  const set = (key) => (val) => onUpdate(stop.id, key, val);
  const { cachedCoords, coordsSaved, savingCoords, handleSaveCoords, handleApplyCache } = useCoordsCache(stop, onUpdate);
  const meta   = STOP_META[stop.type] || STOP_META.incarcare;
  const isVama = stop.type === 'vama';
  const isInc  = stop.type === 'incarcare';
  const pid    = `ap-${stop.id}`;
  const copied = copiedId === stop.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {total > 1 && <span style={{ fontSize: '13px', fontWeight: 600, color: meta.color }}>#{idx + 1}</span>}
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <select className="ap-chip" aria-label="Tip oprire" value={stop.type} onChange={e => onChangeType(stop.id, e.target.value)}
              style={{ appearance: 'none', WebkitAppearance: 'none', minHeight: '32px', padding: '0 30px 0 12px', border: 'none', borderRadius: '999px', background: meta.tint, color: meta.color, fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <option value="incarcare">Încărcare</option>
              <option value="descarcare">Descărcare</option>
              <option value="vama">Vamă</option>
            </select>
            <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 14" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M2 5l3-3 3 3M2 9l3 3 3-3"/></svg>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {total > 1 && <>
            <button type="button" className="ap-icon-btn" aria-label="Mută sus" onClick={() => onMove(idx, -1)} disabled={idx === 0} style={{ ...iconBtn, color: idx === 0 ? 'var(--ap-dash)' : 'var(--ap-sub)', cursor: idx === 0 ? 'default' : 'pointer' }}>
              <Svg size={14} sw={2.2}><polyline points="18 15 12 9 6 15"/></Svg>
            </button>
            <button type="button" className="ap-icon-btn" aria-label="Mută jos" onClick={() => onMove(idx, 1)} disabled={idx === total - 1} style={{ ...iconBtn, color: idx === total - 1 ? 'var(--ap-dash)' : 'var(--ap-sub)', cursor: idx === total - 1 ? 'default' : 'pointer' }}>
              <Svg size={14} sw={2.2}><polyline points="6 9 12 15 18 9"/></Svg>
            </button>
          </>}
          {canDelete && (
            <button type="button" className="ap-icon-btn" aria-label="Șterge oprire" onClick={() => onDelete(stop.id)} style={{ ...iconBtn, color: 'var(--ap-red)' }}>
              <Svg size={14} sw={2.2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>
            </button>
          )}
        </div>
      </div>

      <div style={group}>
        <Row first id={`${pid}-date`} label="Dată" value={stop.date} onChange={set('date')} placeholder="ZZ.LL.AAAA" />
        <Row id={`${pid}-time`} label="Oră" value={stop.time} onChange={set('time')} placeholder="HH:MM sau Direct" />
      </div>

      {isVama ? (
        <div style={group}>
          <Row first id={`${pid}-city`} label="Punct vamal" value={stop.city} onChange={set('city')} placeholder="GIURGIU - RUSE" />
          <Row id={`${pid}-ref`} label="Documente" value={stop.ref} onChange={set('ref')} placeholder="Opțional" />
        </div>
      ) : (
        <>
          <div style={group}>
            <Row first id={`${pid}-company`} label="Firmă" value={stop.company} onChange={set('company')} placeholder={isInc ? 'MUBEA PROSTEJOV' : 'ILN MIOVENI'} />
            <Row id={`${pid}-street`} label="Stradă" value={stop.street} onChange={set('street')} placeholder="ROVNA 4708" />
            <Row id={`${pid}-city`} label="Țară, cod, oraș" value={stop.city} onChange={set('city')} placeholder={isInc ? 'CZ 796 01 PROSTEJOV' : 'RO 115400 MIOVENI'} />
            <Row className="ap-coords" id={`${pid}-coords`} label="Coordonate" value={stop.coords} onChange={set('coords')} placeholder="47.123456, 27.123456" />
            {!stop.coords && cachedCoords && (
              <ActionRow className="ap-save" onClick={handleApplyCache} color="var(--ap-green)"><IconPin /> Aplică coordonatele salvate · {cachedCoords}</ActionRow>
            )}
            {stop.coords && makeAddrKey(stop.street, stop.city) && (coordsSaved
              ? <SavedRow />
              : (
                <ActionRow className="ap-save" onClick={handleSaveCoords} disabled={savingCoords}>
                  <IconSave />
                  {savingCoords ? 'Se salvează…' : 'Salvează coordonatele'}
                </ActionRow>
              ))}
            <ActionRow onClick={() => onCopyAddr(stop.id)} color={copied ? 'var(--ap-green)' : 'var(--ap-accent)'}>
              {copied ? <IconCheck /> : <IconCopy />}
              {copied ? 'Adresă copiată' : 'Copiază adresa pentru Maps'}
            </ActionRow>
          </div>

          <div style={group}>
            {isInc && (
              <div className="ap-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 14px 12px 0' }}>
                <label htmlFor={`${pid}-details`} style={{ fontSize: '15px' }}>Detalii marfă / Tonaj</label>
                <textarea id={`${pid}-details`} className="ap-input" rows={2} value={stop.details} onChange={e => set('details')(e.target.value)} placeholder="Opțional"
                  style={{ padding: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '15px', lineHeight: 1.4, color: 'var(--ap-text)', resize: 'vertical' }} />
              </div>
            )}
            <Row first={!isInc} id={`${pid}-ref`} label="Referință" value={stop.ref} onChange={set('ref')} placeholder="Opțional" />
          </div>
        </>
      )}
    </div>
  );
}

function SectionHead({ num, title, extra, right }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '0 4px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ap-sub)' }}>{num}</span>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ap-text)' }}>{title}</h2>
        {extra && <span style={{ fontSize: '15px', color: 'var(--ap-sub)' }}>{extra}</span>}
      </div>
      {right}
    </div>
  );
}

export default function GenerareComandaApple(p) {
  const {
    fields, setField, stops, incarcari, descarcari, vami,
    updateStop, moveStop, deleteStop, addStop, changeStopType, canDeleteStop, copiedAddr, copyAddr,
    loading, error, fileName, pdfDataUrl, setShowPdfModal, fileRef, handleFileInput, handleDrop,
    dragOver, setDragOver, handleReset, swapStops, handleCopy, copied, previewLines,
  } = p;

  const columns = [
    { type: 'incarcare',  list: incarcari,  basis: '1 1 380px' },
    { type: 'descarcare', list: descarcari, basis: '1 1 380px' },
    ...(vami.length > 0 ? [{ type: 'vama', list: vami, basis: '1 1 100%' }] : []),
  ];
  const dropHandlers = {
    onDragOver: e => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
  };

  return (
    <div style={{ background: 'var(--ap-bg)', color: 'var(--ap-text)', fontFamily: AFONT, fontWeight: 400, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility', borderRadius: '22px', padding: '40px 36px 48px' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: 0, fontSize: '40px', lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.025em' }}>Generare comandă</h1>
          <p style={{ margin: '10px 0 0', maxWidth: '640px', fontSize: '17px', lineHeight: 1.45, color: 'var(--ap-sub)' }}>Încarcă PDF-ul comenzii de transport. Câmpurile se completează automat, iar mesajul e gata de trimis pe WhatsApp.</p>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '32px' }}>
          <div style={{ flex: '1 1 560px', maxWidth: '940px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '36px' }}>

            {/* 1 — Document */}
            <section>
              <SectionHead num="1" title="Document" />
              <div style={{ ...card, padding: '20px' }}>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileInput} />
                {loading ? (
                  <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '36px 20px', borderRadius: '14px', background: 'var(--ap-fill)', fontSize: '15px', color: 'var(--ap-sub)' }}>
                    <svg aria-hidden="true" style={{ animation: 'spin-loader 0.8s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ap-accent)" strokeWidth="2.4" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Se procesează PDF-ul…
                  </div>
                ) : fileName ? (
                  <div {...dropHandlers} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px 16px', padding: '14px', borderRadius: '14px', background: dragOver ? 'var(--ap-tint)' : 'var(--ap-fill)' }}>
                    <span style={{ width: '48px', height: '48px', flexShrink: 0, borderRadius: '12px', background: error ? 'var(--ap-card)' : 'var(--ap-green-tint)', color: error ? 'var(--ap-red)' : 'var(--ap-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {error
                        ? <Svg size={22} sw={1.7}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></Svg>
                        : <Svg size={22} sw={2.4}><path d="M20 6L9 17l-5-5"/></Svg>}
                    </span>
                    <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                      <span style={{ fontSize: '13px', color: error ? 'var(--ap-red)' : 'var(--ap-sub)' }}>{error || `Extras automat · ${stops.length} opriri`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {pdfDataUrl && <button type="button" className="ap-pill-tint ap-press" onClick={() => setShowPdfModal(true)} style={pill('var(--ap-tint)', 'var(--ap-accent)')}>Vezi PDF</button>}
                      <button type="button" className="ap-pill-tint ap-press" onClick={() => fileRef.current?.click()} style={pill('var(--ap-tint)', 'var(--ap-accent)')}>Înlocuiește</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="ap-drop" onClick={() => fileRef.current?.click()} {...dropHandlers}
                    style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '28px 20px', border: `2px dashed ${dragOver ? 'var(--ap-accent)' : 'var(--ap-dash)'}`, borderRadius: '14px', background: dragOver ? 'var(--ap-tint)' : 'var(--ap-fill)', color: 'var(--ap-text)', fontFamily: 'inherit', cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s' }}>
                    <span className="ap-doc-tile" style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--ap-tint)', color: 'var(--ap-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path className="ap-doc-arrow" d="M12 18v-6M9 15l3-3 3 3"/></svg>
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 600 }}>Trage PDF-ul aici</span>
                    <span style={{ fontSize: '15px', color: 'var(--ap-sub)' }}>sau <span style={{ color: 'var(--ap-accent)', fontWeight: 500 }}>alege un fișier</span> · comanda de transport, un singur PDF</span>
                    {error && <span style={{ fontSize: '13px', color: 'var(--ap-red)' }}>{error}</span>}
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '14px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--ap-sub)' }}>{fileName ? 'Comandă încărcată' : 'Nicio comandă încărcată'}</span>
                  <button type="button" className="ap-pill-fill ap-press fm-reset-btn" onClick={handleReset} style={pill('var(--ap-fill)', 'var(--ap-text)')}>
                    <span className="fm-reset-ic" style={{ display: 'inline-flex' }}><Svg size={16} sw={2}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></Svg></span>
                    Resetează
                  </button>
                </div>
              </div>
            </section>

            {/* 2 — Detalii comandă */}
            <section>
              <SectionHead num="2" title="Detalii comandă" />
              <div style={{ ...card, paddingLeft: '20px', overflow: 'hidden' }}>
                <Row first id="ap-order" label="Număr comandă" value={fields.order_number} onChange={setField('order_number')} placeholder="Obligatoriu" labelWidth={160} size={17} />
                <Row id="ap-client" label="Client" value={fields.client} onChange={setField('client')} placeholder="Obligatoriu" labelWidth={160} size={17} />
              </div>
            </section>

            {/* 3 — Traseu */}
            <section>
              <SectionHead num="3" title="Traseu" extra={`${stops.length} opriri`} right={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {vami.length === 0 && (
                    <button type="button" className="ap-pill-tint ap-press" onClick={() => addStop('vama')} style={pill('var(--ap-tint)', 'var(--ap-accent)')}>
                      <Svg size={14} sw={2.2}><path d="M12 5v14M5 12h14"/></Svg> Vamă
                    </button>
                  )}
                  <button type="button" className="ap-pill-tint ap-press" onClick={swapStops} title="Inversează încărcare ↔ descărcare" style={pill('var(--ap-tint)', 'var(--ap-accent)')}>
                    <Svg size={15} sw={2}><path d="M7 4v16M3 8l4-4 4 4"/><path d="M17 20V4M13 16l4 4 4-4"/></Svg> Inversează
                  </button>
                </div>
              } />
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: '20px' }}>
                {columns.map(col => {
                  const meta = STOP_META[col.type];
                  return (
                    <div key={col.type} style={{ ...card, flex: col.basis, minWidth: 0, boxSizing: 'border-box', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: meta.color }} />
                        <span style={{ fontSize: '17px', fontWeight: 600 }}>{meta.label}</span>
                        <span style={{ fontSize: '15px', color: 'var(--ap-sub)' }}>{col.list.length}</span>
                      </div>
                      {col.list.map((stop, idx) => (
                        <div key={stop.id} style={idx > 0 ? { paddingTop: '14px', borderTop: '0.5px solid var(--ap-sep)' } : undefined}>
                          <AppleStop stop={stop} idx={idx} total={col.list.length} onUpdate={updateStop} onMove={(i, dir) => moveStop(col.type, i, dir)} onDelete={deleteStop} canDelete={canDeleteStop(stop)} onChangeType={changeStopType} copiedId={copiedAddr} onCopyAddr={copyAddr} />
                        </div>
                      ))}
                      <button type="button" className="ap-link ap-press" onClick={() => addStop(col.type)} style={{ marginTop: 'auto', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', padding: '0 4px', border: 'none', background: 'transparent', color: 'var(--ap-accent)', fontFamily: 'inherit', fontSize: '15px', fontWeight: 500, cursor: 'pointer' }}>
                        <Svg size={18}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></Svg>
                        {meta.add}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Previzualizare */}
          <aside style={{ flex: '1 1 360px', maxWidth: '460px', minWidth: 0, position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '18px 18px 18px 22px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 600 }}>Previzualizare</span>
                  <span style={{ fontSize: '13px', color: 'var(--ap-sub)' }}>Mesaj WhatsApp</span>
                </div>
                <button type="button" className={`ap-primary ap-press${copied ? ' is-copied' : ''}`} onClick={handleCopy}
                  style={{ ...pill(copied ? 'var(--ap-green-tint)' : 'var(--ap-accent)', copied ? 'var(--ap-green)' : 'var(--ap-on-accent)'), minHeight: '44px', padding: '0 22px', fontWeight: 600 }}>
                  {copied ? <IconCheck /> : <IconCopy />}
                  {copied ? 'Copiat' : 'Copiază'}
                </button>
              </div>
              <div style={{ padding: '20px 22px 26px', maxHeight: '70vh', overflowY: 'auto', background: 'var(--fm-wa-chat-bg)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <WhatsAppBubble lines={previewLines} />
              </div>
            </div>

            <div>
              <div style={{ margin: '0 4px 8px', fontSize: '13px', color: 'var(--ap-sub)' }}>Cum funcționează</div>
              <div style={{ ...card, borderRadius: '14px', paddingLeft: '16px' }}>
                {['Încarcă PDF-ul comenzii de transport.', 'Opririle se extrag automat.', 'Completează sau adaugă opriri în Traseu.', 'Coordonatele se salvează per adresă.'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', paddingRight: '16px', fontSize: '15px', borderTop: i ? '0.5px solid var(--ap-sep)' : 'none' }}>
                    <span style={{ flex: '0 0 22px', height: '22px', borderRadius: '50%', background: 'var(--ap-tint)', color: 'var(--ap-accent)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
