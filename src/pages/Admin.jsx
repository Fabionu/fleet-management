import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { DRIVER_DOC_TYPES, TRUCK_DOC_TYPES } from '../constants/docTypes';

// ── Constante ──────────────────────────────────────────────
const PERM_LABELS = {
  editVehicleInfo:  'Editare info vehicul',
  toggleAmazon:     'Toggle Amazon',
  addTrip:          'Adăugare cursă',
  editTrip:         'Editare cursă',
  deleteTrip:       'Ștergere cursă',
  clearTruckData:   'Golire date camion',
  deleteTruckRow:   'Ștergere rând camion',
  addNextTrip:      'Adăugare cursă următoare',
  markInvoiced:     'Marcare facturată',
};

const PERM_GROUPS = [
  {
    label: 'Vehicule',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    items: [
      { key: 'editVehicleInfo', label: 'Editare info vehicul',   desc: 'Modifică firmă, locație, dată și coordonate pe camion', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
      { key: 'toggleAmazon',    label: 'Toggle Amazon',          desc: 'Activează / dezactivează contul Amazon pe un camion',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
      { key: 'clearTruckData',  label: 'Golire date camion',     desc: 'Resetează statusul și toate datele active ale unui camion', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> },
      { key: 'deleteTruckRow',  label: 'Ștergere rând camion',   desc: 'Elimină definitiv un camion din lista de tracking',       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
    ],
  },
  {
    label: 'Administrare',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
    items: [
      { key: 'accessAdmin',    label: 'Acces panou admin',    desc: 'Permite accesul la panoul de administrare',                            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
      { key: 'accessTrucks',   label: 'Secțiunea Camioane',   desc: 'Poate vedea și gestiona camioanele din flotă',                         icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
      { key: 'accessDrivers',  label: 'Secțiunea Șoferi',     desc: 'Poate vedea și gestiona șoferii și documentele lor',                   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
      { key: 'accessTrailers', label: 'Secțiunea Remorci',    desc: 'Poate vedea și gestiona remorcile (ITP, RCA, stare)',                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="18" height="10" rx="2"/><circle cx="6" cy="19" r="2"/><circle cx="16" cy="19" r="2"/><path d="M20 12h2"/></svg> },
      { key: 'accessUsers',    label: 'Secțiunea Utilizatori', desc: 'Poate vedea și gestiona conturile utilizatorilor din organizație',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { key: 'accessLogs',     label: 'Jurnal activitate',    desc: 'Poate consulta istoricul acțiunilor efectuate în aplicație',           icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    ],
  },
  {
    label: 'Pagini vizibile',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    items: [
      { key: 'viewTracking',  label: 'Status flotă',          desc: 'Acces la pagina de urmărire a vehiculelor în timp real',               icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
      { key: 'viewRegistru',  label: 'Registru curse',        desc: 'Acces la pagina de evidență a curselor și transporturilor',            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
      { key: 'viewChat',      label: 'Chat',                  desc: 'Acces la pagina de mesagerie internă',                                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
      { key: 'viewReports',   label: 'Rapoarte',              desc: 'Acces la pagina de rapoarte financiare și statistici',                 icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    ],
  },
  {
    label: 'Curse',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    items: [
      { key: 'addTrip',     label: 'Adăugare cursă',          desc: 'Creează o cursă nouă în registrul de curse',               icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
      { key: 'editTrip',    label: 'Editare cursă',           desc: 'Modifică detaliile unei curse existente din registru',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
      { key: 'deleteTrip',  label: 'Ștergere cursă',          desc: 'Șterge definitiv o cursă din registru',                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
      { key: 'addNextTrip', label: 'Cursă următoare',         desc: 'Setează o cursă viitoare pe un camion din tracking',        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg> },
      { key: 'markInvoiced',label: 'Marcare facturată',       desc: 'Marchează o cursă ca facturată în registrul de evidență',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    ],
  },
  {
    label: 'Chat',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    items: [
      { key: 'chatCreateGroup',    label: 'Creare grupuri',           desc: 'Poate crea grupuri noi de chat',                                                     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> },
      { key: 'chatManageMembers',  label: 'Gestionare membri grup',   desc: 'Poate adăuga sau elimina membri dintr-un grup de chat',                              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { key: 'chatSendTripOrder',  label: 'Trimitere comandă cursă',  desc: 'Poate trimite comenzi de transport prin chat (modalul „Trimite cursă")',              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
      { key: 'chatDeleteMessage',  label: 'Ștergere mesaje proprii',  desc: 'Poate șterge propriile mesaje din conversații',                                       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
    ],
  },
];

const DEFAULT_PERMISSIONS = {
  admin:      { editVehicleInfo:true,  toggleAmazon:true,  addTrip:true,  editTrip:true,  deleteTrip:true,  clearTruckData:true,  deleteTruckRow:true,  addNextTrip:true,  markInvoiced:true,  accessAdmin:true,  accessTrucks:true,  accessDrivers:true,  accessTrailers:true,  accessUsers:true,  accessLogs:true,  viewTracking:true,  viewRegistru:true,  viewChat:true,  viewReports:true,  chatCreateGroup:true,  chatManageMembers:true,  chatSendTripOrder:true,  chatDeleteMessage:true  },
  dispatcher: { editVehicleInfo:false, toggleAmazon:false, addTrip:true,  editTrip:true,  deleteTrip:false, clearTruckData:true,  deleteTruckRow:true,  addNextTrip:true,  markInvoiced:false, accessAdmin:false, accessTrucks:false, accessDrivers:false, accessTrailers:false, accessUsers:false, accessLogs:false, viewTracking:true,  viewRegistru:true,  viewChat:true,  viewReports:false, chatCreateGroup:true,  chatManageMembers:true,  chatSendTripOrder:true,  chatDeleteMessage:true  },
  contabil:   { editVehicleInfo:false, toggleAmazon:false, addTrip:false, editTrip:true,  deleteTrip:false, clearTruckData:false, deleteTruckRow:false, addNextTrip:false, markInvoiced:true,  accessAdmin:false, accessTrucks:false, accessDrivers:false, accessTrailers:false, accessUsers:false, accessLogs:false, viewTracking:true,  viewRegistru:true,  viewChat:true,  viewReports:false, chatCreateGroup:false, chatManageMembers:false, chatSendTripOrder:false, chatDeleteMessage:true  },
};

const DOC_TYPES = DRIVER_DOC_TYPES;

// ── Tipuri vehicule ─────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: '40t',  label: '40t',  color: '#ef4444', desc: 'Semi-remorcher' },
  { value: '12t',  label: '12t',  color: '#f59e0b', desc: 'Rigid 12t' },
  { value: '10t',  label: '10t',  color: '#3b82f6', desc: 'Rigid 10t' },
  { value: '7.5t', label: '7.5t', color: '#8b5cf6', desc: 'Rigid 7.5t' },
  { value: '3.5t', label: '3.5t', color: '#22c55e', desc: 'Dubă / Van' },
];

const VehicleIcon = ({ type, size = 32 }) => {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    '40t': (
      <svg viewBox="0 0 44 20" width={size} height={Math.round(size * 20 / 44)} {...s}>
        {/* Cab */}
        <path d="M1 14 L1 6 Q1 4.5 2.5 4.5 L10 4.5 L12.5 7 L12.5 14 Z" />
        {/* Coupling */}
        <line x1="12.5" y1="9" x2="15" y2="9" />
        {/* Trailer */}
        <rect x="15" y="5" width="27" height="9" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="9.5" cy="16.5" r="2" />
        <circle cx="32"  cy="16.5" r="2" />
        <circle cx="38"  cy="16.5" r="2" />
      </svg>
    ),
    '12t': (
      <svg viewBox="0 0 40 20" width={size} height={Math.round(size * 20 / 40)} {...s}>
        {/* Cab */}
        <rect x="1" y="6" width="9" height="8" rx="1.5" />
        <path d="M5 6 L10 6 L10 9" />
        {/* Box */}
        <rect x="11" y="3" width="26" height="11" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="8.5" cy="16.5" r="2" />
        <circle cx="28"  cy="16.5" r="2" />
        <circle cx="34"  cy="16.5" r="2" />
      </svg>
    ),
    '10t': (
      <svg viewBox="0 0 36 20" width={size} height={Math.round(size * 20 / 36)} {...s}>
        {/* Cab */}
        <rect x="1" y="6" width="8" height="8" rx="1.5" />
        <path d="M4.5 6 L9 6 L9 9" />
        {/* Box */}
        <rect x="10" y="3" width="22" height="11" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="8"   cy="16.5" r="2" />
        <circle cx="24"  cy="16.5" r="2" />
        <circle cx="29"  cy="16.5" r="2" />
      </svg>
    ),
    '7.5t': (
      <svg viewBox="0 0 30 20" width={size} height={Math.round(size * 20 / 30)} {...s}>
        {/* Cab */}
        <rect x="1" y="6" width="7" height="8" rx="1.5" />
        <path d="M4 6 L8 6 L8 9" />
        {/* Box */}
        <rect x="9" y="3" width="18" height="11" rx="1" />
        {/* Wheels */}
        <circle cx="3.5" cy="16.5" r="2" />
        <circle cx="7.5" cy="16.5" r="2" />
        <circle cx="20"  cy="16.5" r="2" />
        <circle cx="24"  cy="16.5" r="2" />
      </svg>
    ),
    '3.5t': (
      <svg viewBox="0 0 26 20" width={size} height={Math.round(size * 20 / 26)} {...s}>
        {/* Van body */}
        <path d="M1 14 L1 7 L6 3 L23 3 L25 5 L25 14 Z" />
        {/* Windshield */}
        <path d="M2 7 L6 4 L11 4 L11 7 Z" />
        {/* Side window */}
        <rect x="13" y="4" width="8" height="5" rx="0.5" />
        {/* Wheels */}
        <circle cx="5.5" cy="16.5" r="2" />
        <circle cx="19.5" cy="16.5" r="2" />
      </svg>
    ),
  };
  return icons[type] || null;
};

const VehicleBadge = ({ type }) => {
  const vt = VEHICLE_TYPES.find(v => v.value === type);
  if (!vt) return <span style={{ color: 'var(--gray-4)', fontSize: '12px' }}>—</span>;
  return (
    <span style={{ fontSize: '12px', fontWeight: 700, color: vt.color }}>{vt.label}</span>
  );
};

// ── SVG Icons ──────────────────────────────────────────────
const IconUsers = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="4"/>
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    <path d="M21 21v-2a4 4 0 0 0-3-3.87"/>
  </svg>
);

const IconTruck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="15" height="11" rx="2"/>
    <path d="M16 8h4l3 4v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const IconDriver = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {/* Inel exterior */}
    <circle cx="12" cy="12" r="10"/>
    {/* Butuc central */}
    <circle cx="12" cy="12" r="2.5"/>
    {/* Spite: sus, dreapta-jos, stânga-jos — 120° între ele */}
    <line x1="12" y1="9.5"  x2="12"   y2="2"/>
    <line x1="14.2" y1="13.2" x2="20.7" y2="17"/>
    <line x1="9.8"  y1="13.2" x2="3.3"  y2="17"/>
  </svg>
);

const IconLog = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="13" y2="17"/>
  </svg>
);

const IconRoles = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconTrailer = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="5" width="19" height="10" rx="1.5"/>
    <line x1="7"  y1="5" x2="7"  y2="15"/>
    <line x1="13" y1="5" x2="13" y2="15"/>
    <circle cx="5.5"  cy="18" r="2"/>
    <circle cx="14.5" cy="18" r="2"/>
    <line x1="20" y1="10" x2="23" y2="10"/>
    <circle cx="23" cy="10" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ── Componente utilitare ───────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div style={{
      position:'fixed', bottom:'32px', left:'50%', transform:'translateX(-50%)', zIndex:9999,
      background:'#22c55e', color:'#fff', padding:'12px 20px',
      borderRadius:'8px', fontSize:'14px', fontWeight:500,
      boxShadow:'0 4px 16px rgba(0,0,0,0.2)',
      display:'flex', alignItems:'center', gap:'8px',
      animation:'slideIn 0.2s ease'
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      {msg}
    </div>
  );
}

function ConfirmDialog({ msg, onConfirm, onCancel }) {
  if (!msg) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
      <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', padding:'28px 32px', minWidth:'320px', textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <p style={{ color:'var(--black)', fontSize:'15px', marginBottom:'20px', lineHeight:1.5 }}>{msg}</p>
        <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
          <button onClick={onCancel} style={{ padding:'9px 22px', borderRadius:'7px', border:'1px solid var(--gray-3)', background:'var(--gray-1)', color:'var(--black)', cursor:'pointer', fontSize:'14px', fontWeight:500 }}>Anulează</button>
          <button onClick={onConfirm} style={{ padding:'9px 22px', borderRadius:'7px', border:'none', background:'#ef4444', color:'#fff', cursor:'pointer', fontSize:'14px', fontWeight:600 }}>Șterge</button>
        </div>
      </div>
    </div>
  );
}

// ── Header secțiune cu buton înapoi ────────────────────────
function SectionHeader({ title, icon, count, onBack, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <button onClick={onBack} style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:34, height:34, borderRadius:'8px',
          border:'1px solid var(--gray-3)', background:'var(--gray-1)',
          cursor:'pointer', color:'var(--gray-4)', transition:'all 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.color='var(--black)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--gray-1)'; e.currentTarget.style.color='var(--gray-4)'; }}
        >
          <IconBack />
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ color:'#ff7a3d' }}>{icon}</span>
          <h3 style={{ color:'var(--black)', fontSize:'17px', fontWeight:700, margin:0 }}>{title}</h3>
          {count !== undefined && (
            <span style={{ fontSize:'12px', color:'var(--gray-4)', background:'var(--gray-2)', borderRadius:'20px', padding:'2px 10px', fontWeight:500 }}>{count}</span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Dashboard carduri ──────────────────────────────────────
function Dashboard({ onSelect, counts, canSeeUsers, canSeeLogs, canSeeTrucks, canSeeDrivers, canSeeTrailers, canSeeRoles }) {
  const allCards = [
    {
      key: 'utilizatori',
      icon: <IconUsers />,
      title: 'Utilizatori',
      desc: 'Gestionare conturi, roluri și permisiuni',
      color: '#3b82f6',
      count: counts.users,
      countLabel: 'utilizatori',
    },
    {
      key: 'roluri',
      icon: <IconRoles />,
      title: 'Roluri',
      desc: 'Roluri custom cu permisiuni predefinite',
      color: '#f59e0b',
      count: counts.roles,
      countLabel: 'roluri',
    },
    {
      key: 'camioane',
      icon: <IconTruck />,
      title: 'Camioane',
      desc: 'Flotă vehicule, remorcă, carduri carburant',
      color: '#ff7a3d',
      count: counts.trucks,
      countLabel: 'vehicule',
    },
    {
      key: 'soferi',
      icon: <IconDriver />,
      title: 'Șoferi',
      desc: 'Lista șoferi și documente (pașaport, permis)',
      color: '#22c55e',
      count: counts.drivers,
      countLabel: 'șoferi',
    },
    {
      key: 'remorci',
      icon: <IconTrailer />,
      title: 'Remorci',
      desc: 'Gestiune remorci, ITP, RCA și stare',
      color: '#0d9488',
      count: counts.trailers,
      countLabel: 'remorci',
    },
    {
      key: 'jurnal',
      icon: <IconLog />,
      title: 'Jurnal activitate',
      desc: 'Istoricul acțiunilor în aplicație',
      color: '#8b5cf6',
      count: counts.logs,
      countLabel: 'înregistrări',
    },
  ];

  const cards = allCards.filter(c => {
    if (c.key === 'utilizatori') return canSeeUsers;
    if (c.key === 'roluri')      return canSeeRoles;
    if (c.key === 'camioane')    return canSeeTrucks;
    if (c.key === 'soferi')      return canSeeDrivers;
    if (c.key === 'remorci')     return canSeeTrailers;
    if (c.key === 'jurnal')      return canSeeLogs;
    return true;
  });

  return (
    <div>
      <p style={{ color:'var(--gray-4)', fontSize:'14px', marginBottom:'24px', marginTop:0 }}>
        Selectează o secțiune pentru administrare.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px' }}>
        {cards.map(card => (
          <AdminCard key={card.key} card={card} onClick={() => onSelect(card.key)} />
        ))}
      </div>
    </div>
  );
}

function AdminCard({ card, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--gray-1)' : 'var(--bg-page)',
        border: `1.5px solid ${hovered ? card.color + '66' : 'var(--gray-2)'}`,
        borderRadius: '14px',
        padding: '24px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: hovered ? `0 4px 20px ${card.color}18` : '0 1px 4px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: card.color,
        borderRadius: '14px 14px 0 0',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.18s'
      }} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '12px',
          background: card.color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: card.color,
          transition: 'background 0.18s',
        }}>
          {card.icon}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'24px', fontWeight:700, color:'var(--black)', lineHeight:1 }}>
            {card.count ?? '—'}
          </div>
          <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'2px' }}>{card.countLabel}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize:'15px', fontWeight:700, color:'var(--black)', marginBottom:'4px' }}>{card.title}</div>
        <div style={{ fontSize:'12px', color:'var(--gray-4)', lineHeight:1.5 }}>{card.desc}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'4px', color: card.color, fontSize:'12px', fontWeight:600, opacity: hovered ? 1 : 0.5, transition:'opacity 0.18s' }}>
        Deschide <IconChevron />
      </div>
    </div>
  );
}

// ── Secțiunea Utilizatori ──────────────────────────────────
function SectionUtilizatori({ onBack }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ username:'', password:'', role_id:'', permissions:{}, first_name:'', last_name:'' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([api.getUsers(), api.getRoles()]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const getRoleById = (id) => roles.find(r => r.id === id || r.id === Number(id));
  const getRoleByName = (name) => roles.find(r => r.name.toLowerCase() === name?.toLowerCase());

  const openAdd = () => {
    const defaultRole = roles.find(r => r.name === 'Dispecer') || roles[0];
    setForm({ username:'', password:'', role_id: defaultRole?.id || '', permissions: defaultRole ? { ...defaultRole.permissions } : { ...DEFAULT_PERMISSIONS.dispatcher }, first_name:'', last_name:'' });
    setModal({ mode:'add' });
  };
  const openEdit = (u) => {
    // Try to find role by role_id first, then by legacy role name
    const matchedRole = u.role_id ? getRoleById(u.role_id) : getRoleByName(u.role === 'admin' ? 'Administrator' : u.role === 'dispatcher' ? 'Dispecer' : u.role === 'contabil' ? 'Contabil' : u.role === 'camion' ? 'Camion' : u.role);
    setForm({ username:u.username, password:'', role_id: matchedRole?.id || u.role_id || '', permissions:{ ...u.permissions }, first_name:u.first_name||'', last_name:u.last_name||'' });
    setModal({ mode:'edit', user:u });
  };
  const handleRoleChange = (roleId) => {
    const role = getRoleById(roleId);
    setForm(f => ({ ...f, role_id: roleId, permissions: role ? { ...role.permissions } : {} }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) return;
    setSaving(true);
    try {
      const selectedRole = getRoleById(form.role_id);
      // Map role name to legacy role field for backwards compat
      const legacyRole = selectedRole?.name === 'Administrator' ? 'admin' : selectedRole?.name === 'Dispecer' ? 'dispatcher' : selectedRole?.name === 'Contabil' ? 'contabil' : selectedRole?.name === 'Camion' ? 'camion' : 'dispatcher';
      if (modal.mode === 'add') {
        if (!form.password.trim()) { setSaving(false); return; }
        await api.createUser({ username:form.username, password:form.password, role:legacyRole, role_id:form.role_id, permissions:form.permissions, first_name:form.first_name, last_name:form.last_name });
        setToast('Utilizator adăugat');
      } else {
        await api.updateUser(modal.user.id, { password:form.password||undefined, role:legacyRole, role_id:form.role_id, permissions:form.permissions, first_name:form.first_name, last_name:form.last_name });
        setToast('Utilizator actualizat');
      }
      setModal(null); load();
    } catch (err) { setToast(err.response?.data?.error || 'Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteUser(confirm.id); setToast('Utilizator șters'); load(); }
    catch { setToast('Eroare la ștergere'); }
    setConfirm(null);
  };

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Utilizatori" icon={<IconUsers />} count={users.length} onBack={onBack}
        action={<button onClick={openAdd} style={btnPrimary}>+ Adaugă utilizator</button>}
      />

      {loading ? <Loader /> : (
        <Table headers={['Utilizator','Rol','Permisiuni','Acțiuni']}>
          {[...users].sort((a, b) => {
            const order = { admin: 0, contabil: 1, dispatcher: 2 };
            return (order[a.role] ?? 3) - (order[b.role] ?? 3);
          }).map((u, i) => {
            const matchedRole = u.role_id ? getRoleById(u.role_id) : getRoleByName(u.role === 'admin' ? 'Administrator' : u.role === 'dispatcher' ? 'Dispecer' : u.role === 'contabil' ? 'Contabil' : u.role === 'camion' ? 'Camion' : u.role);
            const roleColor = matchedRole?.color || '#6b7280';
            const roleLabel = matchedRole?.name || u.role;
            return (
              <tr key={u.id} style={{ borderBottom: i < users.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
                <td style={tdStyle}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <Avatar name={u.first_name || u.username} color={roleColor} />
                    <div>
                      {(u.first_name || u.last_name) && (
                        <div style={{ fontWeight:600, color:'var(--black)', fontSize:'13px' }}>{[u.first_name, u.last_name].filter(Boolean).join(' ')}</div>
                      )}
                      <div style={{ fontSize: (u.first_name || u.last_name) ? '11px' : '13px', color: (u.first_name || u.last_name) ? 'var(--gray-4)' : 'var(--black)', fontWeight: (u.first_name || u.last_name) ? 400 : 600 }}>{u.username}</div>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  <Badge label={roleLabel} color={roleColor} />
                </td>
                <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {Object.entries(u.permissions).filter(([,v])=>v).map(([k])=>PERM_LABELS[k]||k).join(', ')||'—'}
                </td>
                <td style={tdStyle}>
                  <Actions onEdit={() => openEdit(u)} onDelete={() => setConfirm({ msg:`Ștergi utilizatorul "${u.username}"?`, id:u.id })} />
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă utilizator' : `Editează: ${modal.user.username}`} onClose={() => setModal(null)} width={480}>
          <div style={{ display:'grid', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <Field label="Prenume">
                <input value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} style={inputStyle} placeholder="ex: Ion" />
              </Field>
              <Field label="Nume">
                <input value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} style={inputStyle} placeholder="ex: Popescu" />
              </Field>
            </div>
            {modal.mode === 'add' && (
              <Field label="Username *">
                <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} style={inputStyle} />
              </Field>
            )}
            <Field label={modal.mode==='edit' ? 'Parolă nouă (opțional)' : 'Parolă *'}>
              <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={inputStyle} />
            </Field>
            <Field label="Rol">
              <select value={form.role_id} onChange={e=>handleRoleChange(e.target.value)} style={inputStyle}>
                <option value="">— Selectează rol —</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}{r.is_system ? ' (sistem)' : ''}</option>
                ))}
              </select>
            </Field>
            <div>
              <div style={{ fontSize:'12px', color:'var(--gray-4)', fontWeight:500, marginBottom:'12px' }}>Permisiuni</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                {PERM_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', color:'var(--gray-4)' }}>
                      {group.icon}
                      <span style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>{group.label}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {group.items.map(({ key, label, desc, icon }) => (
                        <label key={key} style={{ display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer', padding:'9px 11px', borderRadius:'8px', border:'1px solid var(--border)', background: form.permissions[key] ? 'var(--gray-1)' : 'var(--surface)', transition:'background 0.15s, border-color 0.15s', borderColor: form.permissions[key] ? 'var(--gray-3)' : 'var(--border)' }}>
                          <input type="checkbox" checked={!!form.permissions[key]}
                            onChange={e=>setForm(f=>({...f, permissions:{...f.permissions,[key]:e.target.checked}}))}
                            style={{ marginTop:'2px', flexShrink:0, accentColor:'#ff7a3d', cursor:'pointer' }} />
                          <div style={{ color: form.permissions[key] ? 'var(--gray-4)' : 'var(--gray-3)', marginTop:'1px', flexShrink:0, transition:'color 0.15s' }}>
                            {icon}
                          </div>
                          <div>
                            <div style={{ fontSize:'13px', fontWeight:500, color:'var(--black)', lineHeight:1.3 }}>{label}</div>
                            <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'3px', lineHeight:1.4 }}>{desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Secțiunea Camioane ─────────────────────────────────────
function SectionCamioane({ onBack }) {
  const [trucks, setTrucks] = useState([]);
  const [trailersList, setTrailersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ number:'', trailer:'', fuel_card:'', fuel_card_expiry:'', phone:'', drivers:'', vehicle_type:'' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Stare documente camion ──
  const [docsModal, setDocsModal]   = useState(null);
  const [docs, setDocs]             = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [addingDoc, setAddingDoc]   = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docForm, setDocForm]       = useState({ doc_type:'itp', file_name:'', file_data:'', file_type:'', expiry_date:'' });
  const docFileRef                  = useRef(null);
  const [truckDocs, setTruckDocs]   = useState({}); // { truckId: [docs] }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, trRes] = await Promise.all([api.getTrucks(), api.getTrailers().catch(() => ({ data: [] }))]);
      const list = res.data;
      setTrucks(list);
      setTrailersList(trRes.data || []);
      // Încarcă documentele pentru toate camioanele (în paralel)
      const entries = await Promise.all(
        list.map(async t => {
          try { const r = await api.getTruckDocuments(t.id); return [t.id, r.data]; }
          catch { return [t.id, []]; }
        })
      );
      setTruckDocs(Object.fromEntries(entries));
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadDocs = async (id) => {
    setDocsLoading(true);
    try { const res = await api.getTruckDocuments(id); setDocs(res.data); } catch {}
    setDocsLoading(false);
  };

  const openDocs = (truck) => {
    setDocsModal(truck); setDocs([]); setAddingDoc(false); setEditingDoc(null);
    setDocForm({ doc_type:'itp', file_name:'', file_data:'', file_type:'', expiry_date:'' });
    loadDocs(truck.id);
  };

  const openAdd = () => {
    setForm({ number:'', trailer:'', fuel_card:'', fuel_card_expiry:'', phone:'', drivers:'', vehicle_type:'' });
    setModal({ mode:'add' });
  };
  const openEdit = (t) => {
    setForm({ number:t.number||'', trailer:t.trailer||'', fuel_card:t.fuel_card||'', fuel_card_expiry:t.fuel_card_expiry||'', phone:t.phone||'', drivers:t.drivers||'', vehicle_type:t.vehicle_type||'' });
    setModal({ mode:'edit', truck:t });
  };

  const handleSave = async () => {
    if (!form.number.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.createTruck({
          number:form.number, trailer:form.trailer, fuel_card:form.fuel_card,
          fuel_card_expiry:form.fuel_card_expiry, phone:form.phone, drivers:form.drivers,
          vehicle_type:form.vehicle_type||null,
          status:'liber', amazon_account:0, vignettes:'[]', next_trip:null,
          client:'', order_number:'', load_location:'', load_date:'', load_lat:'', load_lng:'',
          unload_location:'', unload_date:'', unload_lat:'', unload_lng:'', eta:'',
          observations:'', pause_date:'', pause_time:'',
          weekend_duration:'', weekend_day:'', weekend_time:'', weekend_week:'', weekend_history:'[]',
          file_name:null, file_data:null, file_type:null,
        });
        setToast('Camion adăugat');
      } else {
        const t = modal.truck;
        await api.updateTruck(t.id, {
          ...t,
          number:form.number, trailer:form.trailer, fuel_card:form.fuel_card,
          fuel_card_expiry:form.fuel_card_expiry, phone:form.phone, drivers:form.drivers,
          vehicle_type:form.vehicle_type||null,
          amazon_account: t.amazon_account===true||t.amazon_account===1 ? 1 : 0,
          vignettes: typeof t.vignettes==='string' ? t.vignettes : JSON.stringify(t.vignettes||[]),
          next_trip: typeof t.next_trip==='string' ? t.next_trip : JSON.stringify(t.next_trip||null),
          weekend_history: typeof t.weekend_history==='string' ? t.weekend_history : JSON.stringify(t.weekend_history||[]),
        });
        setToast('Camion actualizat');
      }
      setModal(null); load();
    } catch (err) { setToast(err.response?.data?.error || 'Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteTruck(confirm.id); setToast('Camion șters'); load(); }
    catch { setToast('Eroare la ștergere'); }
    setConfirm(null);
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDocForm(f => ({ ...f, file_name:file.name, file_data:ev.target.result, file_type:file.type }));
    reader.readAsDataURL(file);
  };

  const handleSaveDoc = async () => {
    setSaving(true);
    try {
      if (editingDoc) {
        await api.updateTruckDocument(editingDoc.id, docForm);
        setToast('Document actualizat');
      } else {
        await api.createTruckDocument({ ...docForm, truck_id:docsModal.id });
        setToast('Document adăugat');
      }
      setAddingDoc(false); setEditingDoc(null);
      setDocForm({ doc_type:'itp', file_name:'', file_data:'', file_type:'', expiry_date:'' });
      await loadDocs(docsModal.id);
      // Reîncarcă badge-urile din tabel
      try { const r = await api.getTruckDocuments(docsModal.id); setTruckDocs(prev => ({ ...prev, [docsModal.id]: r.data })); } catch {}
    } catch { setToast('Eroare'); }
    setSaving(false);
  };

  const handleDeleteDoc = async (id) => {
    try {
      await api.deleteTruckDocument(id);
      setToast('Document șters');
      await loadDocs(docsModal.id);
      try { const r = await api.getTruckDocuments(docsModal.id); setTruckDocs(prev => ({ ...prev, [docsModal.id]: r.data })); } catch {}
    } catch { setToast('Eroare'); }
  };

  const isExpired      = (d) => d && new Date(d) < new Date();
  const isExpiringSoon = (d) => { if (!d) return false; const diff = (new Date(d) - new Date()) / (1000*60*60*24); return diff >= 0 && diff <= 30; };
  const docStatusColor = (d) => isExpired(d) ? '#ef4444' : isExpiringSoon(d) ? '#f59e0b' : '#22c55e';
  const docStatusLabel = (d) => isExpired(d) ? 'Expirat' : isExpiringSoon(d) ? 'Expiră curând' : d ? 'Valid' : '';

  const statusColor = { liber:'#22c55e', incarcare:'#f59e0b', descarcare:'#3b82f6', tranzit:'#8b5cf6', booked:'#ff7a3d', weekend:'#ec4899' };
  const TRUCK_DOC_SHORT = { itp:'ITP', rca:'RCA', casco:'CASCO', cemt:'CEMT', tahograf:'Taho', licenta:'Lic.' };

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Camioane" icon={<IconTruck />} count={trucks.length} onBack={onBack}
        action={<button onClick={openAdd} style={btnPrimary}>+ Adaugă camion</button>}
      />

      {loading ? <Loader /> : (
        <Table headers={['Nr. camion','Tip','Status','Șoferi','Remorcă','Card carburant','Expirare',...TRUCK_DOC_TYPES.map(t=>TRUCK_DOC_SHORT[t.key]||t.label),'Acțiuni']}>
          {trucks.map((t, i) => (
            <tr key={t.id} style={{ borderBottom: i<trucks.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
              <td style={tdStyle}><span style={{ fontWeight:700, color:'var(--black)' }}>{t.number}</span></td>
              <td style={tdStyle}><VehicleBadge type={t.vehicle_type} /></td>
              <td style={tdStyle}><Badge label={t.status} color={statusColor[t.status]||'#6b7280'} /></td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.drivers||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.trailer||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.fuel_card||'—'}</td>
              <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.fuel_card_expiry||'—'}</td>
              {TRUCK_DOC_TYPES.map(dt => {
                const tDocs = truckDocs[t.id] || [];
                const doc   = tDocs.find(x => x.doc_type === dt.key);
                const exp   = doc?.expiry_date;
                const expired = exp && new Date(exp) < new Date();
                const soon    = exp && !expired && (new Date(exp)-new Date())/(1000*60*60*24)<=30;
                const color   = !doc ? 'var(--gray-4)' : expired ? 'var(--red)' : soon ? '#d97706' : '#16a34a';
                const border  = !doc ? 'var(--gray-3)' : expired ? 'var(--red)' : soon ? '#f59e0b' : '#16a34a';
                const title   = !doc ? 'Lipsă' : exp ? `Expiră: ${exp.split('-').reverse().join('.')}` : doc ? 'Fără dată' : '';
                return (
                  <td key={dt.key} style={{ padding:'10px 8px', textAlign:'center' }}>
                    <span title={title} style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:color, border:`1px solid ${border}`, cursor:'default' }} />
                  </td>
                );
              })}
              <td style={tdStyle}>
                <div style={{ display:'flex', gap:'5px' }}>
                  <button onClick={() => openDocs(t)}
                    style={{ ...iconBtnBase, color:'var(--black)' }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                    <SvgEdit /> Documente
                  </button>
                  <button onClick={() => openEdit(t)}
                    style={{ ...iconBtnBase, color:'var(--black)' }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                    <SvgEdit /> Editează
                  </button>
                  <button onClick={() => setConfirm({ msg:`Ștergi camionul "${t.number}"? Se vor pierde toate datele!`, id:t.id })}
                    style={{ ...iconBtnBase, color:'var(--red)' }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                    <SvgTrash /> Șterge
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Modal add/edit camion */}
      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă camion' : `Editează: ${modal.truck.number}`} onClose={() => setModal(null)} width={460}>
          <div style={{ display:'grid', gap:'12px' }}>
            {[
              { key:'number', label:'Număr camion *', disabled:modal.mode==='edit' },
              { key:'fuel_card', label:'Card carburant' },
              { key:'fuel_card_expiry', label:'Expirare card' },
              { key:'phone', label:'Telefon firmă' },
              { key:'drivers', label:'Șoferi (text liber)' },
            ].map(({ key, label, disabled }) => (
              <Field key={key} label={label}>
                <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} disabled={disabled}
                  style={{ ...inputStyle, background: disabled ? 'var(--gray-2)' : 'var(--gray-1)', color: disabled ? 'var(--gray-4)' : 'var(--black)' }} />
              </Field>
            ))}
            <Field label="Remorcă">
              <select value={form.trailer} onChange={e=>setForm(f=>({...f,trailer:e.target.value}))} style={inputStyle}>
                <option value="">— Fără remorcă —</option>
                {trailersList.map(tr => (
                  <option key={tr.id} value={tr.number}>{tr.number}{tr.type ? ` · ${tr.type}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Tip vehicul">
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'2px' }}>
                {VEHICLE_TYPES.map(vt => {
                  const sel = form.vehicle_type === vt.value;
                  return (
                    <button key={vt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, vehicle_type: sel ? '' : vt.value }))}
                      title={vt.desc}
                      style={{
                        padding:'5px 10px', borderRadius:'7px', cursor:'pointer', transition:'all 0.15s',
                        border: `2px solid ${sel ? vt.color : 'var(--gray-3)'}`,
                        background: sel ? vt.color + '1a' : 'transparent',
                        color: sel ? vt.color : 'var(--gray-4)',
                        display:'flex', alignItems:'center', gap:'5px',
                        fontSize:'12px', fontWeight:700,
                      }}
                    >
                      {vt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}

      {/* Modal documente camion */}
      {docsModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:8000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', padding:'28px', width:600, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:36, height:36, borderRadius:'8px', background:'#ff7a3d18', display:'flex', alignItems:'center', justifyContent:'center', color:'#ff7a3d' }}>
                  <IconTruck />
                </div>
                <div>
                  <div style={{ fontWeight:700, color:'var(--black)', fontSize:'15px' }}>{docsModal.number}</div>
                  <div style={{ fontSize:'12px', color:'var(--gray-4)' }}>Documente camion</div>
                </div>
              </div>
              <button onClick={() => { setDocsModal(null); setAddingDoc(false); }}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--gray-4)', fontSize:'22px', lineHeight:1 }}>×</button>
            </div>

            {docsLoading ? <Loader /> : (
              <>
                {docs.length === 0 && !addingDoc && <EmptyState msg="Niciun document adăugat" />}
                <div style={{ display:'grid', gap:'8px', marginBottom:'12px' }}>
                  {docs.map(doc => (
                    <div key={doc.id} style={{ padding:'12px 14px', background:'var(--gray-1)', borderRadius:'9px', border:'1px solid var(--gray-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                        <div style={{ width:36, height:36, borderRadius:'8px', background: doc.expiry_date ? docStatusColor(doc.expiry_date)+'18' : 'var(--gray-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
                          📄
                        </div>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--black)', fontSize:'13px' }}>{TRUCK_DOC_TYPES.find(t => t.key === doc.doc_type)?.label || doc.doc_type}</div>
                          <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'2px' }}>
                            {doc.file_name || 'Fără fișier'}
                            {doc.expiry_date && (
                              <span style={{ marginLeft:8, color: docStatusColor(doc.expiry_date), fontWeight:600 }}>
                                · {doc.expiry_date} · {docStatusLabel(doc.expiry_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'5px' }}>
                        {doc.file_data && (
                          <a href={doc.file_data} download={doc.file_name}
                            style={{ padding:'5px 9px', background:'var(--gray-2)', border:'1px solid var(--gray-3)', borderRadius:'5px', cursor:'pointer', fontSize:'12px', color:'var(--black)', textDecoration:'none' }}>↓</a>
                        )}
                        <button
                          onClick={() => {
                            setDocForm({ doc_type:doc.doc_type, file_name:doc.file_name||'', file_data:doc.file_data||'', file_type:doc.file_type||'', expiry_date:doc.expiry_date||'' });
                            setEditingDoc(doc); setAddingDoc(true);
                          }}
                          style={{ ...iconBtnBase, color:'var(--black)' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                        >
                          <SvgEdit /> Editează
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          style={{ ...iconBtnBase, color:'var(--red)' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                        >
                          <SvgTrash /> Șterge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {addingDoc ? (
                  <div style={{ padding:'16px', background:'var(--gray-1)', borderRadius:'10px', border:'1px solid var(--gray-2)' }}>
                    <div style={{ fontWeight:600, color:'var(--black)', fontSize:'14px', marginBottom:'12px' }}>
                      {editingDoc ? 'Editează document' : 'Document nou'}
                    </div>
                    <div style={{ display:'grid', gap:'10px' }}>
                      <Field label="Tip document">
                        <select value={docForm.doc_type} onChange={e=>setDocForm(f=>({...f,doc_type:e.target.value}))} style={inputStyle}>
                          {TRUCK_DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Data expirare">
                        <input type="date" value={docForm.expiry_date} onChange={e=>setDocForm(f=>({...f,expiry_date:e.target.value}))} style={inputStyle} />
                      </Field>
                      <Field label="Fișier (PDF)">
                        <input ref={docFileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display:'none' }} />
                        <button type="button" onClick={() => docFileRef.current?.click()}
                          style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 12px', border:'1px solid var(--gray-3)', borderRadius:'7px', background:'transparent', color:'var(--black)', cursor:'pointer', fontSize:'12px', fontWeight:500, transition:'all 0.15s', width:'100%' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          {docForm.file_name ? docForm.file_name : 'Selectează fișier PDF'}
                        </button>
                      </Field>
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                      <button onClick={() => { setAddingDoc(false); setEditingDoc(null); }}
                        style={{ padding:'7px 16px', border:'1px solid var(--gray-3)', background:'var(--gray-2)', borderRadius:'6px', cursor:'pointer', fontSize:'12px', color:'var(--black)' }}>Anulează</button>
                      <button onClick={handleSaveDoc} disabled={saving}
                        style={{ padding:'7px 16px', border:'none', background: saving ? 'var(--gray-3)' : '#ff7a3d', color:'#fff', borderRadius:'6px', cursor: saving ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:600, opacity:saving?0.7:1, display:'flex', alignItems:'center', gap:'6px' }}>
                        {saving && <svg style={{ animation:'spin-loader 0.8s linear infinite', flexShrink:0 }} width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
                        {saving ? 'Se salvează...' : 'Salvează document'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setDocForm({ doc_type:'itp', file_name:'', file_data:'', file_type:'', expiry_date:'' }); setEditingDoc(null); setAddingDoc(true); }}
                    style={{ width:'100%', padding:'10px', background:'transparent', border:'2px dashed var(--gray-3)', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'var(--gray-4)', transition:'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#ff7a3d'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--gray-3)'}
                  >
                    + Adaugă document
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Secțiunea Șoferi ───────────────────────────────────────
function SectionSoferi({ onBack }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [form, setForm] = useState({ first_name:'', last_name:'', hire_date:'', is_active:1, assigned_truck:'' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docForm, setDocForm] = useState({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' });
  const docFileRef = useRef(null);
  const [search, setSearch] = useState('');
  const [trucks, setTrucks] = useState([]);

  const getFullName = (d) => {
    if (d.first_name || d.last_name) return [d.first_name, d.last_name].filter(Boolean).join(' ');
    return d.name || '';
  };

  const getAssociatedTruck = (driver) => {
    const fullName = getFullName(driver);
    return trucks.find(t => t.drivers && t.drivers.toLowerCase().includes(fullName.toLowerCase()));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [driversRes, trucksRes] = await Promise.all([api.getDrivers(), api.getTrucks()]);
      setDrivers(driversRes.data);
      setTrucks(trucksRes.data);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadDocs = async (id) => {
    setDocsLoading(true);
    try { const res = await api.getDriverDocuments(id); setDocs(res.data); } catch {}
    setDocsLoading(false);
  };

  const openDocs = (driver) => {
    setDocsModal(driver); setDocs([]); setAddingDoc(false); setEditingDoc(null);
    setDocForm({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' });
    loadDocs(driver.id);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    setSaving(true);
    try {
      const payload = { first_name:form.first_name, last_name:form.last_name, hire_date:form.hire_date||null, is_active:form.is_active };
      let driverId;
      if (modal.mode === 'add') { const r = await api.createDriver(payload); driverId = r.data.id; setToast('Șofer adăugat'); }
      else { await api.updateDriver(modal.driver.id, payload); driverId = modal.driver.id; setToast('Șofer actualizat'); }
      await api.assignDriverTruck(driverId, form.assigned_truck || null);
      setModal(null); load();
    } catch { setToast('Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteDriver(confirm.id); setToast('Șofer șters'); load(); }
    catch { setToast('Eroare'); }
    setConfirm(null);
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDocForm(f => ({ ...f, file_name:file.name, file_data:ev.target.result, file_type:file.type }));
    reader.readAsDataURL(file);
  };

  const handleSaveDoc = async () => {
    setSaving(true);
    try {
      if (editingDoc) { await api.updateDriverDocument(editingDoc.id, docForm); setToast('Document actualizat'); }
      else { await api.createDriverDocument({ ...docForm, driver_id:docsModal.id }); setToast('Document adăugat'); }
      setAddingDoc(false); setEditingDoc(null);
      setDocForm({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' });
      loadDocs(docsModal.id);
    } catch { setToast('Eroare'); }
    setSaving(false);
  };

  const handleDeleteDoc = async (id) => {
    try { await api.deleteDriverDocument(id); setToast('Document șters'); loadDocs(docsModal.id); }
    catch { setToast('Eroare'); }
  };

  const isExpired = (d) => d && new Date(d) < new Date();
  const isExpiringSoon = (d) => {
    if (!d) return false;
    const diff = (new Date(d) - new Date()) / (1000*60*60*24);
    return diff >= 0 && diff <= 30;
  };
  const docStatusColor = (d) => isExpired(d) ? '#ef4444' : isExpiringSoon(d) ? '#f59e0b' : '#22c55e';
  const docStatusLabel = (d) => isExpired(d) ? 'Expirat' : isExpiringSoon(d) ? 'Expiră curând' : d ? 'Valid' : '';

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Șoferi" icon={<IconDriver />} count={drivers.length} onBack={onBack}
        action={
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'var(--gray-4)', pointerEvents:'none' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Caută șofer..."
                style={{ width:'200px', padding:'9px 12px 9px 32px', border:'1px solid var(--gray-3)', borderRadius:'8px', background:'var(--gray-1)', color:'var(--black)', fontSize:'13px', outline:'none', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor='#ff7a3d'}
                onBlur={e => e.target.style.borderColor='var(--gray-3)'} />
            </div>
            <button onClick={() => { setForm({ first_name:'', last_name:'', hire_date:'', is_active:1, assigned_truck:'' }); setModal({ mode:'add' }); }} style={btnPrimary}>+ Adaugă șofer</button>
          </div>
        }
      />

      {loading ? <Loader /> : drivers.length === 0 ? (
        <EmptyState msg="Niciun șofer adăugat încă" />
      ) : (() => {
        const DOC_SHORT = { pasaport:'Pașaport', permis:'Permis', ci:'CI', tahograf:'Tahograf', a1macron:'A1' };
        const filtered = drivers.filter(d => getFullName(d).toLowerCase().includes(search.toLowerCase()));
        if (filtered.length === 0) return <EmptyState msg={`Niciun rezultat pentru "${search}"`} />;
        return (
          <div style={{ border:'1px solid var(--gray-2)', borderRadius:'12px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ background:'var(--gray-1)', borderBottom:'1px solid var(--gray-2)' }}>
                  {['#','Nume','Angajat din','Status','Camion',...DOC_TYPES.map(t=>DOC_SHORT[t.key]||t.label),'Acțiuni'].map((h,i) => (
                    <th key={i} style={{ padding:'9px 12px', textAlign: i===1?'left':'center', fontWeight:600, color:'var(--gray-4)', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const fullName = getFullName(d);
                  const truck = getAssociatedTruck(d);
                  const hireDate = d.hire_date ? d.hire_date.split('-').reverse().join('.') : '—';
                  return (
                    <tr key={d.id} style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--gray-2)' : 'none', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--gray-1)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 12px', color:'var(--gray-4)', textAlign:'center', width:36 }}>{i+1}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <Avatar name={fullName} color="#22c55e" size={32} />
                          <div>
                            <span style={{ fontWeight:600, color:'var(--black)', display:'block' }}>{d.first_name || d.name}</span>
                            {d.last_name && <span style={{ fontSize:'12px', color:'var(--gray-4)' }}>{d.last_name}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px', color:'var(--gray-4)', textAlign:'center', whiteSpace:'nowrap' }}>{hireDate}</td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'12px', fontWeight:500,
                          color: d.is_active!==0 ? '#16a34a' : 'var(--gray-4)' }}>
                          <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                            background: d.is_active!==0 ? '#16a34a' : 'var(--gray-3)' }} />
                          {d.is_active!==0 ? 'Activ' : 'Inactiv'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center', fontWeight:600, fontSize:'13px',
                        color: truck ? 'var(--black)' : 'var(--gray-4)' }}>
                        {truck ? truck.number : '—'}
                      </td>
                      {DOC_TYPES.map(t => {
                        const doc = (d.documents||[]).find(x => x.doc_type === t.key);
                        const exp = doc?.expiry_date;
                        const expired = exp && new Date(exp) < new Date();
                        const soon = exp && !expired && (new Date(exp)-new Date())/(1000*60*60*24)<=30;
                        const bg = !doc?'var(--gray-2)':expired?'var(--red-light)':soon?'#fef3c7':'#dcfce7';
                        const color = !doc?'var(--gray-4)':expired?'var(--red)':soon?'#d97706':'#16a34a';
                        const border = !doc?'var(--gray-3)':expired?'var(--red)':soon?'#f59e0b':'#16a34a';
                        const title = !doc?'Lipsă':exp?`Expiră: ${exp.split('-').reverse().join('.')}`:doc?'Fără dată':'';
                        return (
                          <td key={t.key} style={{ padding:'10px 8px', textAlign:'center' }}>
                            <span title={title} style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:color, border:`1px solid ${border}`, cursor:'default' }} />
                          </td>
                        );
                      })}
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'5px', justifyContent:'center' }}>
                          <button onClick={() => openDocs(d)}
                            style={{ ...iconBtnBase, color:'var(--black)' }}
                            onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                            <SvgEdit /> Documente
                          </button>
                          <button onClick={() => { setForm({ first_name:d.first_name||'', last_name:d.last_name||'', hire_date:d.hire_date||'', is_active:d.is_active??1, assigned_truck:d.assigned_truck||'' }); setModal({ mode:'edit', driver:d }); }}
                            style={{ ...iconBtnBase, color:'var(--black)' }}
                            onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                            <SvgEdit /> Editează
                          </button>
                          <button onClick={() => setConfirm({ msg:`Ștergi șoferul "${getFullName(d)}"?`, id:d.id })}
                            style={{ ...iconBtnBase, color:'var(--red)' }}
                            onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                            <SvgTrash /> Șterge
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Modal add/edit */}
      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă șofer' : `Editează: ${[modal.driver.first_name, modal.driver.last_name].filter(Boolean).join(' ') || modal.driver.name}`} onClose={() => setModal(null)} width={420}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <Field label="Prenume *">
              <input value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} style={inputStyle} autoFocus placeholder="Ion" />
            </Field>
            <Field label="Nume *">
              <input value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} style={inputStyle} placeholder="Popescu" />
            </Field>
          </div>
          <Field label="Data angajării">
            <input type="date" value={form.hire_date} onChange={e=>setForm(f=>({...f,hire_date:e.target.value}))} style={inputStyle} />
          </Field>
          <Field label="Status">
            <div style={{ display:'flex', background:'var(--gray-1)', borderRadius:'8px', padding:'3px', border:'1px solid var(--gray-2)' }}>
              {[{val:1,label:'Activ'},{val:0,label:'Inactiv'}].map(opt => (
                <button key={opt.val} type="button" onClick={() => setForm(f=>({...f,is_active:opt.val}))}
                  style={{ flex:1, padding:'7px 12px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', transition:'all 0.15s', border:'none',
                    fontWeight: form.is_active===opt.val ? 600 : 400,
                    background: form.is_active===opt.val ? 'var(--bg-page)' : 'transparent',
                    color: form.is_active===opt.val ? 'var(--black)' : 'var(--gray-4)',
                    boxShadow: form.is_active===opt.val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Camion atribuit">
            <select value={form.assigned_truck} onChange={e=>setForm(f=>({...f,assigned_truck:e.target.value}))} style={inputStyle}
              onFocus={e=>e.target.style.borderColor='#ff7a3d'}
              onBlur={e=>e.target.style.borderColor='var(--gray-3)'}>
              <option value="">— Neatribuit —</option>
              {trucks.map(t => (
                <option key={t.number} value={t.number}>{t.number}</option>
              ))}
            </select>
          </Field>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}

      {/* Modal documente */}
      {docsModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:8000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', padding:'28px', width:600, maxWidth:'95vw', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <Avatar name={getFullName(docsModal)} color="#22c55e" size={36} />
                <div>
                  <div style={{ fontWeight:700, color:'var(--black)', fontSize:'15px' }}>{getFullName(docsModal)}</div>
                  <div style={{ fontSize:'12px', color:'var(--gray-4)' }}>Documente identitate</div>
                </div>
              </div>
              <button onClick={() => { setDocsModal(null); setAddingDoc(false); }}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--gray-4)', fontSize:'22px', lineHeight:1 }}>×</button>
            </div>

            {docsLoading ? <Loader /> : (
              <>
                {docs.length === 0 && !addingDoc && <EmptyState msg="Niciun document adăugat" />}
                <div style={{ display:'grid', gap:'8px', marginBottom:'12px' }}>
                  {docs.map(doc => (
                    <div key={doc.id} style={{ padding:'12px 14px', background:'var(--gray-1)', borderRadius:'9px', border:'1px solid var(--gray-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                        <div style={{ width:36, height:36, borderRadius:'8px', background: doc.expiry_date ? docStatusColor(doc.expiry_date)+'18' : 'var(--gray-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
                          📄
                        </div>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--black)', fontSize:'13px' }}>{DOC_TYPES.find(t => t.key === doc.doc_type)?.label || doc.doc_type}</div>
                          <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'2px' }}>
                            {doc.file_name || 'Fără fișier'}
                            {doc.expiry_date && (
                              <span style={{ marginLeft:8, color: docStatusColor(doc.expiry_date), fontWeight:600 }}>
                                · {doc.expiry_date} · {docStatusLabel(doc.expiry_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'5px' }}>
                        {doc.file_data && (
                          <a href={doc.file_data} download={doc.file_name}
                            style={{ padding:'5px 9px', background:'var(--gray-2)', border:'1px solid var(--gray-3)', borderRadius:'5px', cursor:'pointer', fontSize:'12px', color:'var(--black)', textDecoration:'none' }}>↓</a>
                        )}
                        <button
                          onClick={() => {
                            setDocForm({ doc_type:doc.doc_type, file_name:doc.file_name||'', file_data:doc.file_data||'', file_type:doc.file_type||'', expiry_date:doc.expiry_date||'' });
                            setEditingDoc(doc); setAddingDoc(true);
                          }}
                          style={{ ...iconBtnBase, color:'var(--black)' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                        >
                          <SvgEdit /> Editează
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          style={{ ...iconBtnBase, color:'var(--red)' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                        >
                          <SvgTrash /> Șterge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {addingDoc ? (
                  <div style={{ padding:'16px', background:'var(--gray-1)', borderRadius:'10px', border:'1px solid var(--gray-2)' }}>
                    <div style={{ fontWeight:600, color:'var(--black)', fontSize:'14px', marginBottom:'12px' }}>
                      {editingDoc ? 'Editează document' : 'Document nou'}
                    </div>
                    <div style={{ display:'grid', gap:'10px' }}>
                      <Field label="Tip document">
                        <select value={docForm.doc_type} onChange={e=>setDocForm(f=>({...f,doc_type:e.target.value}))} style={inputStyle}>
                          {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Data expirare">
                        <input type="date" value={docForm.expiry_date} onChange={e=>setDocForm(f=>({...f,expiry_date:e.target.value}))} style={inputStyle} />
                      </Field>
                      <Field label="Fișier (PDF)">
                        <input ref={docFileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display:'none' }} />
                        <button type="button" onClick={() => docFileRef.current?.click()}
                          style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 12px', border:'1px solid var(--gray-3)', borderRadius:'7px', background:'transparent', color:'var(--black)', cursor:'pointer', fontSize:'12px', fontWeight:500, transition:'all 0.15s', width:'100%' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          {docForm.file_name ? docForm.file_name : 'Selectează fișier PDF'}
                        </button>
                      </Field>
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                      <button onClick={() => { setAddingDoc(false); setEditingDoc(null); }}
                        style={{ padding:'7px 16px', border:'1px solid var(--gray-3)', background:'var(--gray-2)', borderRadius:'6px', cursor:'pointer', fontSize:'12px', color:'var(--black)' }}>Anulează</button>
                      <button onClick={handleSaveDoc} disabled={saving}
                        style={{ padding:'7px 16px', border:'none', background: saving ? 'var(--gray-3)' : '#ff7a3d', color:'#fff', borderRadius:'6px', cursor: saving ? 'not-allowed' : 'pointer', fontSize:'12px', fontWeight:600, opacity:saving?0.7:1, display:'flex', alignItems:'center', gap:'6px' }}>
                        {saving && <svg style={{ animation:'spin-loader 0.8s linear infinite', flexShrink:0 }} width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
                        {saving ? 'Se salvează...' : 'Salvează document'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setDocForm({ doc_type:'pasaport', file_name:'', file_data:'', file_type:'', expiry_date:'' }); setEditingDoc(null); setAddingDoc(true); }}
                    style={{ width:'100%', padding:'10px', background:'transparent', border:'2px dashed var(--gray-3)', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'var(--gray-4)', transition:'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#ff7a3d'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--gray-3)'}
                  >
                    + Adaugă document
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Secțiunea Jurnal ───────────────────────────────────────
function SectionJurnal({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ user:'', entity:'', search:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.getLogs(); setLogs(res.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const users = [...new Set(logs.map(l => l.username))];
  const entities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (filter.user && l.username !== filter.user) return false;
    if (filter.entity && l.entity_type !== filter.entity) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!`${l.action} ${l.details||''} ${l.username}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const fmtDate = (str) => {
    const d = new Date(str);
    return d.toLocaleDateString('ro-RO', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' +
           d.toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit' });
  };

  const actionColor = (a) => a?.startsWith('Adăug') ? '#22c55e' : a?.startsWith('Editat') ? '#3b82f6' : a?.startsWith('Șters') ? '#ef4444' : '#6b7280';
  const entityLabel = { truck:'Camion', trip:'Cursă', user:'Utilizator', driver:'Șofer' };
  const EntityIcon = ({ type }) => {
    const s = { width:13, height:13, fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' };
    if (type === 'truck') return <svg viewBox="0 0 24 24" {...s}><rect x="1" y="5" width="15" height="11" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    if (type === 'trip') return <svg viewBox="0 0 24 24" {...s}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    if (type === 'user') return <svg viewBox="0 0 24 24" {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    if (type === 'driver') return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2.5"/><line x1="12" y1="9.5" x2="12" y2="2"/><line x1="14.2" y1="13.2" x2="20.7" y2="17"/><line x1="9.8" y1="13.2" x2="3.3" y2="17"/></svg>;
    return null;
  };

  return (
    <div>
      <SectionHeader
        title="Jurnal activitate" icon={<IconLog />} count={filtered.length} onBack={onBack}
        action={
          <button onClick={load} style={{ padding:'7px 14px', background:'var(--gray-1)', border:'1px solid var(--gray-3)', borderRadius:'6px', cursor:'pointer', fontSize:'13px', color:'var(--black)', display:'flex', alignItems:'center', gap:'5px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Reîncarcă
          </button>
        }
      />

      {/* Filtre */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:150 }}>
          <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--gray-4)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Caută..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))}
            style={{ ...inputStyle, paddingLeft:30, width:'100%', boxSizing:'border-box' }} />
        </div>
        <select value={filter.user} onChange={e=>setFilter(f=>({...f,user:e.target.value}))} style={{ ...inputStyle, minWidth:140 }}>
          <option value="">Toți utilizatorii</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filter.entity} onChange={e=>setFilter(f=>({...f,entity:e.target.value}))} style={{ ...inputStyle, minWidth:130 }}>
          <option value="">Toate tipurile</option>
          {entities.map(e => <option key={e} value={e}>{entityLabel[e]||e}</option>)}
        </select>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState msg="Nicio înregistrare găsită" />
      ) : (
        <Table headers={['Data / Ora','Utilizator','Acțiune','Entitate','Detalii']}>
          {filtered.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: i<filtered.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
              <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', whiteSpace:'nowrap' }}>{fmtDate(l.created_at)}</td>
              <td style={tdStyle}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <Avatar name={l.username} size={24} color="#6b7280" />
                  <span style={{ color:'var(--black)', fontWeight:500, fontSize:'13px' }}>{l.username}</span>
                </div>
              </td>
              <td style={tdStyle}><Badge label={l.action} color={actionColor(l.action)} /></td>
              <td style={{ ...tdStyle, fontSize:'12px', color:'var(--gray-4)' }}>
                {l.entity_type ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <EntityIcon type={l.entity_type} />
                    <span>{entityLabel[l.entity_type]||l.entity_type}</span>
                  </div>
                ) : '—'}
              </td>
              <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {l.details||'—'}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ── Componente mici reutilizabile ──────────────────────────
const tdStyle = { padding:'11px 14px', verticalAlign:'middle' };
const inputStyle = { padding:'8px 10px', borderRadius:'7px', border:'1px solid var(--gray-3)', background:'var(--gray-1)', color:'var(--black)', fontSize:'13px', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
const btnPrimary = { padding:'8px 16px', background:'#ff7a3d', color:'#fff', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:600 };

function Loader() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 0', gap:'12px', animation:'fade-up-loader 0.3s ease both' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation:'spin-loader 0.7s linear infinite', transformOrigin:'center' }}>
        <circle cx="12" cy="12" r="9" stroke="var(--gray-2)" strokeWidth="2.5"/>
        <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize:'13px', color:'var(--gray-4)', fontWeight:400 }}>Se încarcă...</span>
    </div>
  );
}
function EmptyState({ msg }) { return <p style={{ color:'var(--gray-4)', textAlign:'center', padding:'40px 0', fontSize:'14px' }}>{msg}</p>; }
function Avatar({ color='#ff7a3d', size=28 }) {
  const iconSize = Math.round(size * 0.52);
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:color+'22', border:`1.5px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
  );
}
function Badge({ label, color }) {
  return (
    <span style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600, background:color+'20', color }}>
      {label}
    </span>
  );
}
const SvgEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const SvgTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const iconBtnBase = {
  padding: '6px 10px', background: 'transparent', border: '1px solid var(--gray-3)',
  borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: '5px', transition: 'all 0.15s',
  fontSize: '12px', fontWeight: 500,
};
function Actions({ onEdit, onDelete }) {
  return (
    <div style={{ display:'flex', gap:'5px' }}>
      <button
        onClick={onEdit}
        style={{ ...iconBtnBase, color: 'var(--black)' }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
      >
        <SvgEdit /> Editează
      </button>
      <button
        onClick={onDelete}
        style={{ ...iconBtnBase, color: 'var(--red)' }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
      >
        <SvgTrash /> Șterge
      </button>
    </div>
  );
}
function Table({ headers, children }) {
  return (
    <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'10px', overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--gray-2)', background:'var(--gray-1)' }}>
              {headers.map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'var(--gray-4)', fontWeight:600, fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <span style={{ fontSize:'12px', color:'var(--gray-4)', fontWeight:500 }}>{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, onClose, children, width=480 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:8000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
      <div style={{ background:'var(--bg-page)', border:'1px solid var(--gray-2)', borderRadius:'14px', width, maxWidth:'95vw', maxHeight:'90vh', boxShadow:'0 8px 32px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'22px 28px 16px', borderBottom:'1px solid var(--gray-2)', flexShrink:0 }}>
          <h3 style={{ color:'var(--black)', margin:0, fontSize:'16px', fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--gray-4)', fontSize:'22px', lineHeight:1 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'22px 28px 0' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
function ModalFooter({ onCancel, onSave, saving }) {
  return (
    <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', position:'sticky', bottom:0, background:'var(--bg-page)', borderTop:'1px solid var(--gray-2)', padding:'14px 0 22px', marginTop:'22px' }}>
      <button onClick={onCancel} style={{ padding:'9px 20px', border:'1px solid var(--gray-3)', background:'var(--gray-1)', borderRadius:'7px', cursor:'pointer', color:'var(--black)', fontSize:'13px', fontWeight:500, fontFamily:'inherit' }}>Anulează</button>
      <button onClick={onSave} disabled={saving} style={{ padding:'9px 20px', border:'none', background: saving ? 'var(--gray-3)' : '#ff7a3d', color:'#fff', borderRadius:'7px', cursor: saving ? 'not-allowed' : 'pointer', fontSize:'13px', fontWeight:600, opacity:saving?0.7:1, display:'flex', alignItems:'center', gap:'7px', fontFamily:'inherit' }}>
        {saving && <svg style={{ animation:'spin-loader 0.8s linear infinite', flexShrink:0 }} width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>}
        {saving ? 'Se salvează...' : 'Salvează'}
      </button>
    </div>
  );
}

// ── Secțiunea Remorci ─────────────────────────────────────
const TRAILER_TYPES = [
  { value: 'prelata',     label: 'Prelată',     color: '#ff7a3d' },
  { value: 'frigorific',  label: 'Frigorific',  color: '#3b82f6' },
  { value: 'caroserie',   label: 'Caroserie',   color: '#6b7280' },
  { value: 'cisterna',    label: 'Cisternă',    color: '#8b5cf6' },
  { value: 'platforma',   label: 'Platformă',   color: '#0d9488' },
  { value: 'basculabila', label: 'Basculabilă', color: '#f59e0b' },
];

const TRAILER_STATUSES = [
  { value: 'libera',   label: 'Liberă',  color: '#22c55e' },
  { value: 'atasata',  label: 'Atașată', color: '#3b82f6' },
  { value: 'service',  label: 'Service', color: '#f59e0b' },
  { value: 'defecta',  label: 'Defectă', color: '#ef4444' },
];

function TrailerTypeBadge({ type }) {
  const t = TRAILER_TYPES.find(x => x.value === type);
  if (!t) return <span style={{ color: 'var(--gray-3)' }}>—</span>;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'5px', background: t.color + '1a', fontSize:'11px', fontWeight:600, color: t.color, whiteSpace:'nowrap' }}>
      {t.label}
    </span>
  );
}

function ExpiryBadge({ date }) {
  if (!date) return <span style={{ color: 'var(--gray-3)' }}>—</span>;
  const d = new Date(date);
  const diffDays = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  const color = diffDays < 0 ? '#ef4444' : diffDays <= 30 ? '#f59e0b' : '#22c55e';
  const [y, m, z] = date.split('-');
  const formatted = z ? `${z}.${m}.${y}` : date;
  return (
    <span style={{ fontSize:'12px', fontWeight: diffDays <= 30 ? 600 : 400, color }}>
      {formatted}
    </span>
  );
}

function SectionRemorci({ onBack }) {
  const [trailers, setTrailers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ number:'', type:'', status:'libera', current_truck:'', itp_expiry:'', rca_expiry:'', observations:'' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trRes, tkRes] = await Promise.all([api.getTrailers(), api.getTrucks()]);
      setTrailers(trRes.data);
      setTrucks(tkRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ number:'', type:'', status:'libera', current_truck:'', itp_expiry:'', rca_expiry:'', observations:'' });
    setModal({ mode:'add' });
  };

  const openEdit = (t) => {
    setForm({
      number:       t.number       || '',
      type:         t.type         || '',
      status:       t.status       || 'libera',
      current_truck: t.current_truck || '',
      itp_expiry:   t.itp_expiry   || '',
      rca_expiry:   t.rca_expiry   || '',
      observations: t.observations || '',
    });
    setModal({ mode:'edit', trailer: t });
  };

  const handleSave = async () => {
    if (!form.number.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.createTrailer(form);
        setToast('Remorcă adăugată');
      } else {
        await api.updateTrailer(modal.trailer.id, form);
        setToast('Remorcă actualizată');
      }
      setModal(null);
      load();
    } catch (err) {
      setToast(err.response?.data?.error || 'Eroare la salvare');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTrailer(id);
      setToast('Remorcă ștearsă');
      load();
    } catch { setToast('Eroare la ștergere'); }
    setConfirm(null);
  };

  const filtered = trailers.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [t.number, t.type, t.status, t.current_truck, t.observations]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog
        msg={confirm?.msg}
        onConfirm={() => handleDelete(confirm.id)}
        onCancel={() => setConfirm(null)}
      />

      <SectionHeader
        title="Remorci"
        icon={<IconTrailer />}
        count={trailers.length}
        onBack={onBack}
        action={
          <button onClick={openAdd} style={btnPrimary}>
            + Adaugă remorcă
          </button>
        }
      />

      {/* Search */}
      <div style={{ marginBottom:'16px' }}>
        <input
          type="text"
          placeholder="Caută după număr, tip, status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width:'300px' }}
        />
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState msg={search ? 'Nicio remorcă găsită' : 'Nicio remorcă înregistrată'} />
      ) : (
        <Table headers={['Nr. Remorcă','Tip','Status','Camion','ITP','RCA','Observații','Acțiuni']}>
          {filtered.map((t, i) => {
            const statusInfo = TRAILER_STATUSES.find(s => s.value === t.status);
            return (
              <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--gray-2)' : 'none' }}>
                <td style={tdStyle}>
                  <span style={{ fontWeight:700, color:'var(--black)', fontFamily:'monospace', fontSize:'13px' }}>{t.number}</span>
                </td>
                <td style={tdStyle}><TrailerTypeBadge type={t.type} /></td>
                <td style={tdStyle}>
                  {statusInfo
                    ? <Badge label={statusInfo.label} color={statusInfo.color} />
                    : <span style={{ color:'var(--gray-4)' }}>—</span>}
                </td>
                <td style={{ ...tdStyle, color:'var(--gray-4)' }}>{t.current_truck || '—'}</td>
                <td style={tdStyle}><ExpiryBadge date={t.itp_expiry} /></td>
                <td style={tdStyle}><ExpiryBadge date={t.rca_expiry} /></td>
                <td style={{ ...tdStyle, color:'var(--gray-4)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {t.observations || '—'}
                </td>
                <td style={tdStyle}>
                  <Actions
                    onEdit={() => openEdit(t)}
                    onDelete={() => setConfirm({ msg:`Ștergi remorca "${t.number}"?`, id:t.id })}
                  />
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {/* Modal adăugare / editare */}
      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Adaugă remorcă' : `Editează remorca ${modal.trailer?.number}`}
          onClose={() => setModal(null)}
          width={560}
        >
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <Field label="Număr remorcă *">
              <input
                style={inputStyle}
                value={form.number}
                onChange={f('number')}
                placeholder="ex: RO-12-TRL"
                disabled={modal.mode === 'edit'}
              />
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <Field label="Tip remorcă">
                <select style={inputStyle} value={form.type} onChange={f('type')}>
                  <option value="">— Selectează —</option>
                  {TRAILER_TYPES.map(tp => (
                    <option key={tp.value} value={tp.value}>{tp.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select style={inputStyle} value={form.status} onChange={f('status')}>
                  {TRAILER_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Camion atașat">
              <select style={inputStyle} value={form.current_truck} onChange={f('current_truck')}>
                <option value="">— Fără camion —</option>
                {trucks.map(tk => (
                  <option key={tk.id} value={tk.number}>{tk.number}</option>
                ))}
              </select>
            </Field>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <Field label="Expirare ITP">
                <input type="date" style={inputStyle} value={form.itp_expiry} onChange={f('itp_expiry')} />
              </Field>
              <Field label="Expirare RCA">
                <input type="date" style={inputStyle} value={form.rca_expiry} onChange={f('rca_expiry')} />
              </Field>
            </div>

            <Field label="Observații">
              <textarea
                style={{ ...inputStyle, resize:'vertical', minHeight:'72px' }}
                value={form.observations}
                onChange={f('observations')}
                placeholder="Observații opționale..."
              />
            </Field>
          </div>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Secțiunea Roluri ───────────────────────────────────────
function SectionRoluri({ onBack }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name:'', color:'#6b7280', permissions:{} });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.getRoles(); setRoles(res.data); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ name:'', color:'#6b7280', permissions:{} });
    setModal({ mode:'add' });
  };
  const openEdit = (r) => {
    setForm({ name:r.name, color:r.color||'#6b7280', permissions:{ ...r.permissions } });
    setModal({ mode:'edit', role:r });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.createRole({ name:form.name.trim(), color:form.color, permissions:form.permissions });
        setToast('Rol adăugat');
      } else {
        await api.updateRole(modal.role.id, { name:form.name.trim(), color:form.color, permissions:form.permissions });
        setToast('Rol actualizat');
      }
      setModal(null); load();
    } catch (err) { setToast(err.response?.data?.error || 'Eroare'); }
    setSaving(false);
  };

  const doDelete = async () => {
    try { await api.deleteRole(confirm.id); setToast('Rol șters'); load(); }
    catch (err) { setToast(err.response?.data?.error || 'Eroare la ștergere'); }
    setConfirm(null);
  };

  const PRESET_COLORS = ['#ff7a3d','#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444','#0d9488','#ec4899','#6b7280','#111110'];

  return (
    <div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <ConfirmDialog msg={confirm?.msg} onConfirm={doDelete} onCancel={() => setConfirm(null)} />
      <SectionHeader
        title="Roluri" icon={<IconRoles />} count={roles.length} onBack={onBack}
        action={<button onClick={openAdd} style={btnPrimary}>+ Adaugă rol</button>}
      />

      {loading ? <Loader /> : (
        <Table headers={['Rol','Tip','Permisiuni active','Acțiuni']}>
          {roles.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: i < roles.length-1 ? '1px solid var(--gray-2)' : 'none' }}>
              <td style={tdStyle}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:r.color, flexShrink:0 }} />
                  <span style={{ fontWeight:600, color:'var(--black)', fontSize:'13px' }}>{r.name}</span>
                </div>
              </td>
              <td style={tdStyle}>
                {r.is_system
                  ? <span style={{ fontSize:'11px', color:'var(--gray-4)', background:'var(--gray-2)', borderRadius:'20px', padding:'2px 10px', fontWeight:500 }}>Sistem</span>
                  : <span style={{ fontSize:'11px', color:r.color, background:r.color+'20', borderRadius:'20px', padding:'2px 10px', fontWeight:500 }}>Custom</span>
                }
              </td>
              <td style={{ ...tdStyle, color:'var(--gray-4)', fontSize:'12px', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {Object.entries(r.permissions).filter(([,v])=>v).map(([k])=>PERM_LABELS[k]||k).join(', ')||'—'}
              </td>
              <td style={tdStyle}>
                <div style={{ display:'flex', gap:'5px' }}>
                  <button
                    onClick={() => openEdit(r)}
                    style={{ ...iconBtnBase, color:'var(--black)' }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--gray-2)'; e.currentTarget.style.borderColor='var(--gray-4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                  >
                    <SvgEdit /> Editează
                  </button>
                  {!r.is_system && (
                    <button
                      onClick={() => setConfirm({ msg:`Ștergi rolul "${r.name}"?`, id:r.id })}
                      style={{ ...iconBtnBase, color:'var(--red)' }}
                      onMouseEnter={e => { e.currentTarget.style.background='var(--red-light)'; e.currentTarget.style.borderColor='var(--red)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--gray-3)'; }}
                    >
                      <SvgTrash /> Șterge
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal.mode==='add' ? 'Adaugă rol' : `Editează rol: ${modal.role.name}`} onClose={() => setModal(null)} width={520}>
          <div style={{ display:'grid', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'10px', alignItems:'end' }}>
              <Field label="Nume rol *">
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inputStyle} placeholder="ex: Operator logistică" />
              </Field>
              <Field label="Culoare">
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'6px 0' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                      style={{ width:20, height:20, borderRadius:'50%', background:c, border: form.color===c ? '2px solid var(--black)' : '2px solid transparent', cursor:'pointer', outline: form.color===c ? '2px solid '+c : 'none', outlineOffset:'1px', transition:'all 0.1s' }}
                    />
                  ))}
                </div>
              </Field>
            </div>
            <div>
              <div style={{ fontSize:'12px', color:'var(--gray-4)', fontWeight:500, marginBottom:'12px' }}>Permisiuni</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                {PERM_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', color:'var(--gray-4)' }}>
                      {group.icon}
                      <span style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>{group.label}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {group.items.map(({ key, label, desc, icon }) => (
                        <label key={key} style={{ display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer', padding:'9px 11px', borderRadius:'8px', border:'1px solid var(--border)', background: form.permissions[key] ? 'var(--gray-1)' : 'var(--surface)', transition:'background 0.15s, border-color 0.15s', borderColor: form.permissions[key] ? 'var(--gray-3)' : 'var(--border)' }}>
                          <input type="checkbox" checked={!!form.permissions[key]}
                            onChange={e=>setForm(f=>({...f, permissions:{...f.permissions,[key]:e.target.checked}}))}
                            style={{ marginTop:'2px', flexShrink:0, accentColor:'#ff7a3d', cursor:'pointer' }} />
                          <div style={{ color: form.permissions[key] ? 'var(--gray-4)' : 'var(--gray-3)', marginTop:'1px', flexShrink:0, transition:'color 0.15s' }}>
                            {icon}
                          </div>
                          <div>
                            <div style={{ fontSize:'13px', fontWeight:500, color:'var(--black)', lineHeight:1.3 }}>{label}</div>
                            <div style={{ fontSize:'11px', color:'var(--gray-4)', marginTop:'3px', lineHeight:1.4 }}>{desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ModalFooter onCancel={() => setModal(null)} onSave={handleSave} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── Admin principal ────────────────────────────────────────
function Admin({ user }) {
  const [active, setActive] = useState(() => localStorage.getItem('adminSection') || null);
  const [counts, setCounts] = useState({ users:null, roles:null, trucks:null, drivers:null, trailers:null, logs:null });

  useEffect(() => {
    Promise.all([
      api.getUsers().then(r => r.data.length).catch(() => null),
      api.getRoles().then(r => r.data.length).catch(() => null),
      api.getTrucks().then(r => r.data.length).catch(() => null),
      api.getDrivers().then(r => r.data.length).catch(() => null),
      api.getTrailers().then(r => r.data.length).catch(() => null),
      api.getLogs().then(r => r.data.length).catch(() => null),
    ]).then(([users, roles, trucks, drivers, trailers, logs]) => {
      setCounts({ users, roles, trucks, drivers, trailers, logs });
    });
  }, [active]);

  const goTo = (section) => {
    setActive(section);
    if (section) localStorage.setItem('adminSection', section);
    else localStorage.removeItem('adminSection');
  };

  const isAdmin        = user.role === 'admin';
  const canSeeUsers    = isAdmin || user.permissions?.accessUsers;
  const canSeeRoles    = isAdmin || user.permissions?.accessUsers;
  const canSeeLogs     = isAdmin || user.permissions?.accessLogs;
  const canSeeTrucks   = isAdmin || (user.permissions?.accessAdmin && user.permissions?.accessTrucks !== false);
  const canSeeDrivers  = isAdmin || (user.permissions?.accessAdmin && user.permissions?.accessDrivers !== false);
  const canSeeTrailers = isAdmin || (user.permissions?.accessAdmin && user.permissions?.accessTrailers !== false);

  return (
    <div style={{ paddingTop:'16px' }}>
      {!active && <Dashboard onSelect={goTo} counts={counts} canSeeUsers={canSeeUsers} canSeeRoles={canSeeRoles} canSeeLogs={canSeeLogs} canSeeTrucks={canSeeTrucks} canSeeDrivers={canSeeDrivers} canSeeTrailers={canSeeTrailers} />}
      {active === 'utilizatori' && canSeeUsers    && <SectionUtilizatori onBack={() => goTo(null)} />}
      {active === 'roluri'      && canSeeRoles    && <SectionRoluri      onBack={() => goTo(null)} />}
      {active === 'camioane'    && canSeeTrucks   && <SectionCamioane    onBack={() => goTo(null)} />}
      {active === 'soferi'      && canSeeDrivers  && <SectionSoferi      onBack={() => goTo(null)} />}
      {active === 'remorci'     && canSeeTrailers && <SectionRemorci     onBack={() => goTo(null)} />}
      {active === 'jurnal'      && canSeeLogs     && <SectionJurnal      onBack={() => goTo(null)} />}
    </div>
  );
}

export default Admin;
