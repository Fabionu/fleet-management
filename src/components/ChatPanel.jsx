import { useState, useEffect, useRef, useMemo } from 'react';
import { getSocket } from '../services/socket';
import { playReceived, playSent } from '../services/sounds';
import axios from 'axios';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

function roleLabel(role) {
  if (role === 'admin') return 'Administrator';
  if (role === 'dispatcher') return 'Dispecer';
  return 'Contabil';
}

const AVATAR_COLORS = ['#ff7a3d', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899'];
function avatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const GROUP_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f43f5e', '#a855f7', '#84cc16'];
function groupColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

const CHECK_POINTS = '1 4.2 4.2 7.5 11 1';
function SeenIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
      <polyline points={CHECK_POINTS} stroke="#ff7a3d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function SentIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
      <polyline points={CHECK_POINTS} stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GroupIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function renderMessageText(text, currentUser) {
  if (!text || !text.includes('@')) return text;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      const isMentionedMe = part.slice(1) === currentUser;
      return (
        <span key={i} style={{
          color: '#ff7a3d', fontWeight: 600,
          background: isMentionedMe ? 'rgba(255,122,61,0.18)' : 'transparent',
          borderRadius: 3, padding: isMentionedMe ? '0 3px' : 0,
        }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

function getSeenBy(msgIdx, allMsgs, readsForGroup, currentUser) {
  if (!readsForGroup || !allMsgs[msgIdx]) return [];
  const msgTime = new Date(allMsgs[msgIdx].created_at).getTime();
  const nextMsgTime = msgIdx < allMsgs.length - 1
    ? new Date(allMsgs[msgIdx + 1].created_at).getTime()
    : Infinity;
  return Object.entries(readsForGroup)
    .filter(([uname, readAt]) => {
      if (uname === currentUser) return false;
      const rt = new Date(readAt).getTime();
      return rt >= msgTime && rt < nextMsgTime;
    })
    .map(([uname]) => uname);
}

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6 }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px 4px 2px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6 }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  );
}

function ChatInput({ inputRef, value, onChange, onKeyDown, onSend, placeholder, mentionQuery, mentionUsers, mentionHighlight, onMentionSelect }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {mentionQuery !== null && mentionUsers.length > 0 && (
        <div className="chat-scroll" style={{ position: 'absolute', bottom: '100%', left: 12, right: 58, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 -4px 20px rgba(0,0,0,0.18)', maxHeight: 160, overflowY: 'auto', zIndex: 10 }}>
          {mentionUsers.map((u, i) => (
            <div key={u} onMouseDown={e => { e.preventDefault(); onMentionSelect(u); }}
              style={{ padding: '8px 12px', cursor: 'pointer', background: i === mentionHighlight ? 'var(--gray-1)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarColor(u), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {u.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--black)' }}>
                <span style={{ color: '#ff7a3d', fontWeight: 600 }}>@</span>{u}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea ref={inputRef} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
          placeholder={placeholder} rows={1} className="chat-scroll"
          style={{ flex: 1, resize: 'none', border: '1px solid var(--gray-3)', borderRadius: 10, padding: '9px 12px', fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 80, overflowY: 'auto', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#ff7a3d'}
          onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
        />
        <button onClick={onSend} disabled={!value.trim()}
          style={{ width: 38, height: 38, borderRadius: '50%', background: value.trim() ? '#ff7a3d' : 'var(--gray-2)', border: 'none', cursor: value.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <div onClick={onChange}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', transition: 'background 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: checked ? '1.5px solid #ff7a3d' : '1.5px solid var(--gray-3)', background: checked ? '#ff7a3d' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1 3.5 3.5 6 8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(label), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 12 }}>
          {label.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 14, color: 'var(--black)' }}>{label}</span>
      </div>
    </div>
  );
}

export default function ChatPanel({ user }) {
  const [open, setOpen]           = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [slideDir, setSlideDir]   = useState('right');
  const [view, setView]           = useState('contacts');
  const [peer, setPeer]           = useState(null);

  const [orgUsers, setOrgUsers]           = useState([]);
  const [onlineUsers, setOnlineUsers]     = useState([]);
  const [conversations, setConversations] = useState({});
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [lastMessages, setLastMessages]   = useState({});
  const [totalUnread, setTotalUnread]     = useState(0);
  const [peerReadAt, setPeerReadAt]       = useState(null);

  const [groups, setGroups]               = useState([]);
  const [groupUnread, setGroupUnread]     = useState({});
  const [groupMessages, setGroupMessages] = useState({});
  const [activeGroup, setActiveGroup]     = useState(null);
  const [memberReads, setMemberReads]     = useState({});

  const [newGroupName, setNewGroupName]         = useState('');
  const [newGroupMembers, setNewGroupMembers]   = useState([]);
  const [editGroupMembers, setEditGroupMembers] = useState([]);
  const [editGroupName, setEditGroupName]       = useState('');
  const [groupSaving, setGroupSaving]           = useState(false);

  const [inputVal, setInputVal]           = useState('');
  const [search, setSearch]               = useState('');
  const [dmCollapsed, setDmCollapsed]     = useState(() => localStorage.getItem('chat_dm_collapsed') === 'true');
  const [grpsCollapsed, setGrpsCollapsed] = useState(() => localStorage.getItem('chat_grps_collapsed') === 'true');

  const [mentionQuery, setMentionQuery]         = useState(null);
  const [mentionUsers, setMentionUsers]         = useState([]);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [mentionAtIdx, setMentionAtIdx]         = useState(0);

  const mutedKey = `chat_muted_${user.username}`;
  const [muted, setMuted] = useState(() => {
    try { return JSON.parse(localStorage.getItem(mutedKey)) || { dm: [], group: [] }; } catch { return { dm: [], group: [] }; }
  });
  const mutedRef = useRef(muted);

  const openRef         = useRef(false);
  const peerRef         = useRef(null);
  const activeGroupRef  = useRef(null);
  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const searchRef       = useRef(null);
  const newGroupNameRef = useRef(null);

  const token   = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = user.role === 'admin';

  const displayNames = useMemo(() => {
    const map = {};
    orgUsers.forEach(u => {
      const full = [u.first_name, u.last_name].filter(Boolean).join(' ');
      map[u.username] = full || u.username;
    });
    return map;
  }, [orgUsers]);

  const dn = (username) => displayNames[username] || username;

  // ── Load initial data + socket listeners ──────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, onlineRes, unreadRes, lastRes, groupsRes, groupUnreadRes] = await Promise.all([
          axios.get('/api/chat/users', { headers }),
          axios.get('/api/chat/online', { headers }),
          axios.get('/api/chat/unread', { headers }),
          axios.get('/api/chat/last-messages', { headers }),
          axios.get('/api/chat/groups', { headers }),
          axios.get('/api/chat/groups/unread', { headers }),
        ]);
        setOrgUsers(usersRes.data);
        setOnlineUsers(onlineRes.data);
        setUnreadCounts(unreadRes.data);
        setLastMessages(lastRes.data);
        setGroups(groupsRes.data);
        setGroupUnread(groupUnreadRes.data);
        const readsMap = {};
        groupsRes.data.forEach(g => {
          if (g.memberReads) {
            readsMap[g.id] = {};
            g.memberReads.forEach(r => { readsMap[g.id][r.username] = r.last_read_at; });
          }
        });
        setMemberReads(readsMap);
        const privTotal  = Object.values(unreadRes.data).reduce((a, b) => a + b, 0);
        const groupTotal = Object.values(groupUnreadRes.data).reduce((a, b) => a + b, 0);
        setTotalUnread(privTotal + groupTotal);
      } catch {}
    };
    load();

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg) => {
      const isMine    = msg.username === user.username;
      const peerOfMsg = isMine ? msg.receiver_username : msg.username;
      setConversations(prev =>
        prev[peerOfMsg] ? { ...prev, [peerOfMsg]: [...prev[peerOfMsg], msg] } : prev
      );
      setLastMessages(prev => ({
        ...prev,
        [peerOfMsg]: { sender: msg.username, message: msg.message, created_at: msg.created_at },
      }));
      if (!isMine) {
        const chatOpen = openRef.current && peerRef.current?.username === peerOfMsg;
        const isMuted  = mutedRef.current.dm.includes(peerOfMsg);
        if (chatOpen) {
          axios.put(`/api/chat/read/${peerOfMsg}`, {}, { headers }).catch(() => {});
        } else if (!isMuted) {
          playReceived();
          setUnreadCounts(prev => ({ ...prev, [peerOfMsg]: (prev[peerOfMsg] || 0) + 1 }));
        }
      }
    };

    const handleNewGroupMessage = (msg) => {
      const gId = msg.group_id;
      setGroupMessages(prev => prev[gId] ? { ...prev, [gId]: [...prev[gId], msg] } : prev);
      setGroups(prev => prev.map(g =>
        g.id === gId
          ? { ...g, _lastMsg: { sender: msg.username, message: msg.message, created_at: msg.created_at } }
          : g
      ));
      const isActive = openRef.current && activeGroupRef.current?.id === gId;
      const isMuted  = mutedRef.current.group.includes(gId);
      if (!isActive && msg.username !== user.username && msg.message_type !== 'system' && !isMuted) {
        playReceived();
        setGroupUnread(prev => ({ ...prev, [gId]: (prev[gId] || 0) + 1 }));
      }
      if (isActive) {
        axios.put(`/api/chat/groups/${gId}/read`, {}, { headers }).catch(() => {});
      }
    };

    const handleUsersOnline     = (list) => setOnlineUsers(list);
    const handlePeerRead        = ({ reader, last_read_at }) => {
      if (reader === peerRef.current?.username) setPeerReadAt(last_read_at);
    };
    const handleGroupReadUpdate = ({ groupId, username, lastReadAt }) => {
      setMemberReads(prev => ({
        ...prev,
        [groupId]: { ...(prev[groupId] || {}), [username]: lastReadAt }
      }));
    };
    const handleGroupRenamed    = ({ id, name }) => {
      setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
      setActiveGroup(prev => prev?.id === id ? { ...prev, name } : prev);
    };
    const handleGroupCreated    = (g) => {
      setGroups(prev => prev.some(x => x.id === g.id) ? prev : [g, ...prev]);
      const s = getSocket(); if (s) s.emit('join_group', g.id);
    };
    const handleGroupDeleted    = ({ id }) => {
      setGroups(prev => prev.filter(g => g.id !== id));
      setGroupMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
      setGroupUnread(prev => { const n = { ...prev }; delete n[id]; return n; });
      setMemberReads(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (activeGroupRef.current?.id === id) { setView('contacts'); setActiveGroup(null); }
    };
    const handleGroupUpdated    = ({ id, members }) => {
      setGroups(prev => prev.map(g => g.id === id ? { ...g, members } : g));
      if (activeGroupRef.current?.id === id) setActiveGroup(prev => prev ? { ...prev, members } : prev);
    };
    const handleGroupMemberAdded = ({ groupId }) => {
      axios.get('/api/chat/groups', { headers }).then(r => {
        setGroups(r.data);
        const rm = {};
        r.data.forEach(g => {
          if (g.memberReads) { rm[g.id] = {}; g.memberReads.forEach(rr => { rm[g.id][rr.username] = rr.last_read_at; }); }
        });
        setMemberReads(rm);
      }).catch(() => {});
      const s = getSocket(); if (s) s.emit('join_group', groupId);
    };
    const handleGroupMemberRemoved = ({ groupId }) => {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setGroupMessages(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      setGroupUnread(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      setMemberReads(prev => { const n = { ...prev }; delete n[groupId]; return n; });
      if (activeGroupRef.current?.id === groupId) { setView('contacts'); setActiveGroup(null); }
    };

    socket.on('new_private_message',  handleNewMessage);
    socket.on('new_group_message',    handleNewGroupMessage);
    socket.on('users_online',         handleUsersOnline);
    socket.on('peer_read',            handlePeerRead);
    socket.on('group_read_update',    handleGroupReadUpdate);
    socket.on('group_renamed',        handleGroupRenamed);
    socket.on('group_created',        handleGroupCreated);
    socket.on('group_deleted',        handleGroupDeleted);
    socket.on('group_updated',        handleGroupUpdated);
    socket.on('group_member_added',   handleGroupMemberAdded);
    socket.on('group_member_removed', handleGroupMemberRemoved);

    return () => {
      socket.off('new_private_message',  handleNewMessage);
      socket.off('new_group_message',    handleNewGroupMessage);
      socket.off('users_online',         handleUsersOnline);
      socket.off('peer_read',            handlePeerRead);
      socket.off('group_read_update',    handleGroupReadUpdate);
      socket.off('group_renamed',        handleGroupRenamed);
      socket.off('group_created',        handleGroupCreated);
      socket.off('group_deleted',        handleGroupDeleted);
      socket.off('group_updated',        handleGroupUpdated);
      socket.off('group_member_added',   handleGroupMemberAdded);
      socket.off('group_member_removed', handleGroupMemberRemoved);
    };
  }, []);

  // Request fresh online list after listeners are registered
  useEffect(() => {
    const socket = getSocket();
    if (socket?.connected) socket.emit('get_online_users');
    else if (socket) socket.once('connect', () => socket.emit('get_online_users'));
  }, []);

  // Ghost unread fix — refresh counts each time panel opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      axios.get('/api/chat/unread', { headers }),
      axios.get('/api/chat/groups/unread', { headers }),
    ]).then(([u, g]) => { setUnreadCounts(u.data); setGroupUnread(g.data); }).catch(() => {});
  }, [open]);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  useEffect(() => {
    const pt = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    const gt = Object.values(groupUnread).reduce((a, b) => a + b, 0);
    setTotalUnread(pt + gt);
  }, [unreadCounts, groupUnread]);

  useEffect(() => {
    if (view === 'chat' && peer) messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [conversations]);

  useEffect(() => {
    if (view === 'group-chat' && activeGroup) messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [groupMessages]);

  useEffect(() => {
    if (view === 'chat' || view === 'group-chat') {
      requestAnimationFrame(() => { inputRef.current?.focus(); messagesEndRef.current?.scrollIntoView(); });
    }
    if (view === 'contacts') requestAnimationFrame(() => searchRef.current?.focus());
    if (view === 'create-group') requestAnimationFrame(() => newGroupNameRef.current?.focus());
  }, [view, peer?.username, activeGroup?.id]);

  // ── Mute helpers ──────────────────────────────────────────
  const toggleMuteDm = (username) => {
    setMuted(prev => {
      const already = prev.dm.includes(username);
      const next = { ...prev, dm: already ? prev.dm.filter(u => u !== username) : [...prev.dm, username] };
      mutedRef.current = next;
      localStorage.setItem(mutedKey, JSON.stringify(next));
      return next;
    });
  };
  const toggleMuteGroup = (gId) => {
    setMuted(prev => {
      const already = prev.group.includes(gId);
      const next = { ...prev, group: already ? prev.group.filter(id => id !== gId) : [...prev.group, gId] };
      mutedRef.current = next;
      localStorage.setItem(mutedKey, JSON.stringify(next));
      return next;
    });
  };

  // ── Actions ────────────────────────────────────────────────
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => { setOpen(false); setIsClosing(false); setSlideDir('right'); }, 210);
  };

  const openConversation = async (u) => {
    setSlideDir('right'); setPeer(u); setActiveGroup(null); setView('chat'); setPeerReadAt(null);
    const fetchMsgs = !conversations[u.username]
      ? axios.get(`/api/chat/messages/${u.username}`, { headers })
      : Promise.resolve(null);
    const fetchPR = axios.get(`/api/chat/peer-read/${u.username}`, { headers });
    const [msgsRes, prRes] = await Promise.allSettled([fetchMsgs, fetchPR]);
    if (msgsRes.status === 'fulfilled' && msgsRes.value)
      setConversations(prev => ({ ...prev, [u.username]: msgsRes.value.data }));
    if (prRes.status === 'fulfilled') setPeerReadAt(prRes.value.data?.last_read_at || null);
    if (unreadCounts[u.username] > 0) {
      axios.put(`/api/chat/read/${u.username}`, {}, { headers }).catch(() => {});
      setUnreadCounts(prev => ({ ...prev, [u.username]: 0 }));
    }
  };

  const openGroupConversation = async (g) => {
    setSlideDir('right'); setPeer(null); setActiveGroup(g); setView('group-chat');
    if (!groupMessages[g.id]) {
      try {
        const res = await axios.get(`/api/chat/groups/${g.id}/messages`, { headers });
        setGroupMessages(prev => ({ ...prev, [g.id]: res.data }));
      } catch {}
    }
    if (groupUnread[g.id] > 0) {
      axios.put(`/api/chat/groups/${g.id}/read`, {}, { headers }).catch(() => {});
      setGroupUnread(prev => ({ ...prev, [g.id]: 0 }));
      const now = new Date().toISOString();
      setMemberReads(prev => ({ ...prev, [g.id]: { ...(prev[g.id] || {}), [user.username]: now } }));
    }
  };

  const goBack = () => {
    setSlideDir('left');
    if (view === 'group-members') {
      setView('group-chat');
    } else {
      setView('contacts'); setPeer(null); setActiveGroup(null);
      setInputVal(''); setPeerReadAt(null); setMentionQuery(null);
    }
  };

  const handleInputChange = (val) => {
    setInputVal(val);
    const cursorPos = inputRef.current?.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      let available = [];
      if (view === 'group-chat' && activeGroup)
        available = (activeGroup.members || []).filter(u => u !== user.username);
      else if (view === 'chat' && peer)
        available = [peer.username];
      const filtered = available.filter(u => u.toLowerCase().startsWith(query));
      if (filtered.length > 0) {
        setMentionQuery(query); setMentionUsers(filtered);
        setMentionHighlight(0); setMentionAtIdx(cursorPos - atMatch[0].length);
      } else { setMentionQuery(null); }
    } else { setMentionQuery(null); }
  };

  const insertMention = (username) => {
    const before = inputVal.slice(0, mentionAtIdx);
    const after  = inputVal.slice(mentionAtIdx + 1 + (mentionQuery?.length || 0));
    const newVal = before + '@' + username + ' ' + after;
    setInputVal(newVal); setMentionQuery(null);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = before.length + username.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const sendMessage = async () => {
    const msg = inputVal.trim();
    if (!msg) return;
    setInputVal(''); setMentionQuery(null);
    if (view === 'group-chat' && activeGroup) {
      try { await axios.post(`/api/chat/groups/${activeGroup.id}/messages`, { message: msg }, { headers }); playSent(); } catch {}
    } else if (view === 'chat' && peer) {
      try { await axios.post('/api/chat/messages', { to: peer.username, message: msg }, { headers }); playSent(); } catch {}
    }
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlight(h => Math.min(h + 1, mentionUsers.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionHighlight(h => Math.max(h - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); insertMention(mentionUsers[mentionHighlight]); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Group actions ──────────────────────────────────────────
  const openCreateGroup = () => { setNewGroupName(''); setNewGroupMembers([]); setSlideDir('right'); setView('create-group'); };
  const toggleCreateMember = (uname) => setNewGroupMembers(prev => prev.includes(uname) ? prev.filter(m => m !== uname) : [...prev, uname]);

  const submitCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.length === 0) return;
    setGroupSaving(true);
    try {
      const res = await axios.post('/api/chat/groups', { name: newGroupName.trim(), members: newGroupMembers }, { headers });
      setGroups(prev => prev.some(g => g.id === res.data.id) ? prev : [res.data, ...prev]);
      setView('contacts');
    } catch (e) { alert(e.response?.data?.error || 'Eroare la creare grup'); }
    finally { setGroupSaving(false); }
  };

  const openGroupMembers = () => {
    setEditGroupMembers(activeGroup?.members || []);
    setEditGroupName(activeGroup?.name || '');
    setSlideDir('right'); setView('group-members');
  };
  const toggleEditMember = (uname) => setEditGroupMembers(prev => prev.includes(uname) ? prev.filter(m => m !== uname) : [...prev, uname]);

  const submitEditMembers = async () => {
    if (!activeGroup) return;
    setGroupSaving(true);
    try {
      const nameChanged = editGroupName.trim() && editGroupName.trim() !== activeGroup.name;
      const tasks = [axios.put(`/api/chat/groups/${activeGroup.id}/members`, { members: editGroupMembers }, { headers })];
      if (nameChanged) tasks.push(axios.put(`/api/chat/groups/${activeGroup.id}/name`, { name: editGroupName.trim() }, { headers }));
      const [membersRes] = await Promise.all(tasks);
      setActiveGroup(prev => prev ? { ...prev, members: membersRes.data.members } : prev);
      setView('group-chat');
    } catch (e) { alert(e.response?.data?.error || 'Eroare la actualizare'); }
    finally { setGroupSaving(false); }
  };

  const deleteGroup = async () => {
    if (!activeGroup) return;
    if (!window.confirm(`Ștergi grupul „${activeGroup.name}"? Toate mesajele vor fi pierdute.`)) return;
    try {
      await axios.delete(`/api/chat/groups/${activeGroup.id}`, { headers });
      setView('contacts'); setActiveGroup(null);
    } catch (e) { alert(e.response?.data?.error || 'Eroare la ștergere'); }
  };

  const toggleDm   = () => { const n = !dmCollapsed;   setDmCollapsed(n);   localStorage.setItem('chat_dm_collapsed', n); };
  const toggleGrps = () => { const n = !grpsCollapsed; setGrpsCollapsed(n); localStorage.setItem('chat_grps_collapsed', n); };

  // ── Helpers ────────────────────────────────────────────────
  const isOnline = (uname) => onlineUsers.includes(uname);
  const isRead   = (msg)   => peerReadAt && new Date(peerReadAt) >= new Date(msg.created_at);

  const sortedUsers = [...orgUsers].sort((a, b) => {
    const ao = isOnline(a.username), bo = isOnline(b.username);
    if (ao && !bo) return -1; if (!ao && bo) return 1;
    const al = lastMessages[a.username]?.created_at || '';
    const bl = lastMessages[b.username]?.created_at || '';
    if (al > bl) return -1; if (bl > al) return 1;
    return a.username.localeCompare(b.username);
  });
  const filteredUsers  = search.trim()
    ? sortedUsers.filter(u => {
        const q = search.trim().toLowerCase();
        return u.username.toLowerCase().includes(q) ||
          (u.first_name || '').toLowerCase().includes(q) ||
          (u.last_name || '').toLowerCase().includes(q);
      })
    : sortedUsers;
  const filteredGroups = search.trim() ? groups.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase())) : groups;
  const messages  = (peer && conversations[peer.username]) || [];
  const groupMsgs = (activeGroup && groupMessages[activeGroup.id]) || [];

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>

      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)} title="Mesaje"
          style={{ width: 52, height: 52, borderRadius: '50%', background: '#ff7a3d', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(255,122,61,0.45)', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', animation: 'chatPanelIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(255,122,61,0.65)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,122,61,0.45)'; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {totalUnread > 0 && (
            <div style={{ position: 'absolute', top: -3, right: -3, background: '#ef4444', color: 'white', borderRadius: '50%', minWidth: 20, height: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-body)', padding: '0 4px', boxSizing: 'border-box' }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{ width: 400, height: 580, background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", animation: isClosing ? 'chatPanelOut 0.2s ease forwards' : 'chatPanelIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>

          {/* CONTACTS HEADER */}
          {view === 'contacts' && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ padding: '13px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--gray-1)', borderBottom: '1px solid var(--gray-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)' }}>Mesaje</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-4)' }}>· {onlineUsers.filter(u => u !== user.username).length} online</span>
                </div>
                <CloseBtn onClick={handleClose} />
              </div>
              <div style={{ padding: '8px 12px', background: 'var(--bg-page)', borderBottom: '1px solid var(--gray-2)' }}>
                <div style={{ position: 'relative' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Caută după nume..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CHAT / GROUP-CHAT HEADER */}
          {(view === 'chat' || view === 'group-chat') && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gray-1)', flexShrink: 0 }}>
              <BackBtn onClick={goBack} />
              {view === 'chat' ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: peer ? avatarColor(peer.username) : '#ff7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 15 }}>
                    {(peer?.first_name || peer?.username || '').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--gray-1)' }}/>
                </div>
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: activeGroup ? groupColor(activeGroup.name) : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                  <GroupIcon size={17} color="white" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {view === 'chat' ? dn(peer?.username) : activeGroup?.name}
                </div>
                {view === 'chat' ? (
                  <div style={{ fontSize: 11, color: isOnline(peer?.username) ? '#22c55e' : 'var(--gray-4)' }}>
                    {isOnline(peer?.username) ? 'online' : 'offline'}
                  </div>
                ) : (
                  <div onClick={openGroupMembers}
                    style={{ fontSize: 11, color: 'var(--gray-4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff7a3d'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}>
                    {activeGroup?.members?.length || 0} membri
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                )}
              </div>
              {/* Mute toggle */}
              {view === 'chat' && peer && (
                <button onClick={() => toggleMuteDm(peer.username)}
                  title={muted.dm.includes(peer.username) ? 'Activează notificări' : 'Silențios'}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, color: muted.dm.includes(peer.username) ? 'var(--gray-3)' : 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0 }}>
                  {muted.dm.includes(peer.username)
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  }
                </button>
              )}
              {view === 'group-chat' && activeGroup && (
                <button onClick={() => toggleMuteGroup(activeGroup.id)}
                  title={muted.group.includes(activeGroup.id) ? 'Activează notificări' : 'Silențios'}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 5, color: muted.group.includes(activeGroup.id) ? 'var(--gray-3)' : 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0 }}>
                  {muted.group.includes(activeGroup.id)
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  }
                </button>
              )}
              <CloseBtn onClick={handleClose} />
            </div>
          )}

          {/* CREATE GROUP HEADER */}
          {view === 'create-group' && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gray-1)', flexShrink: 0 }}>
              <BackBtn onClick={goBack} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)' }}>Grup nou</div>
                <div style={{ fontSize: 11, color: 'var(--gray-4)' }}>Adaugă un nume și selectează membri</div>
              </div>
              <CloseBtn onClick={handleClose} />
            </div>
          )}

          {/* GROUP MEMBERS HEADER */}
          {view === 'group-members' && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gray-1)', flexShrink: 0 }}>
              <BackBtn onClick={goBack} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isAdmin ? 'Editare grup' : `Membri — ${activeGroup?.name}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-4)' }}>
                  {isAdmin ? 'Redenumire, adaugă / elimină membri' : `${activeGroup?.members?.length || 0} membri`}
                </div>
              </div>
              <CloseBtn onClick={handleClose} />
            </div>
          )}

          {/* CONTACTS LIST */}
          {view === 'contacts' && (
            <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', animation: slideDir === 'left' ? 'chatSlideFromLeft 0.2s ease' : 'none' }}>

              {/* DM section */}
              <div onClick={toggleDm}
                style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                  Mesaje directe {dmCollapsed && filteredUsers.length > 0 ? `(${filteredUsers.length})` : ''}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5"
                  style={{ transform: dmCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              {!dmCollapsed && filteredUsers.length === 0 && !search && (
                <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, padding: '12px 14px' }}>Niciun coleg în organizație.</div>
              )}
              {!dmCollapsed && filteredUsers.map((u, i) => {
                const last = lastMessages[u.username], unread = unreadCounts[u.username] || 0, online = isOnline(u.username);
                return (
                  <div key={u.username} onClick={() => openConversation(u)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.12s', animation: 'chatItemIn 0.22s ease both', animationDelay: `${Math.min(i * 40, 220)}ms` }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 17 }}>
                        {(u.first_name || u.username).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: online ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--bg-page)', transition: 'background 0.3s' }}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)' }}>{dn(u.username)}</span>
                          {dn(u.username) !== u.username && <span style={{ fontSize: 11, color: 'var(--gray-4)', marginLeft: 5 }}>@{u.username}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {muted.dm.includes(u.username) && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="2" title="Silențios"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                          {last && <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{formatTime(last.created_at)}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {last ? (last.sender === user.username ? `Tu: ${last.message}` : last.message) : <em style={{ fontStyle: 'italic', opacity: 0.7 }}>{roleLabel(u.role)}</em>}
                        </span>
                        {unread > 0 && (
                          <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Groups section */}
              {(!search || filteredGroups.length > 0) && (
                <div style={{ borderTop: filteredUsers.length > 0 && !dmCollapsed ? '1px solid var(--gray-2)' : 'none' }}>
                  <div onClick={toggleGrps}
                    style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                      Grupuri {grpsCollapsed && filteredGroups.length > 0 ? `(${filteredGroups.length})` : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); openCreateGroup(); }}
                          title="Grup nou"
                          style={{ background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', padding: '2px 7px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Nou
                        </button>
                      )}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5"
                        style={{ transform: grpsCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {!grpsCollapsed && filteredGroups.length === 0 && !search && (
                <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 12, padding: '10px 14px 16px', fontStyle: 'italic' }}>
                  {isAdmin ? 'Niciun grup creat.' : 'Nu ești în niciun grup.'}
                </div>
              )}
              {!grpsCollapsed && filteredGroups.map((g, i) => {
                const unread = groupUnread[g.id] || 0, lastMsg = g._lastMsg;
                return (
                  <div key={g.id} onClick={() => openGroupConversation(g)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderBottom: i < filteredGroups.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.12s', animation: 'chatItemIn 0.22s ease both', animationDelay: `${Math.min(i * 40, 220)}ms` }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: groupColor(g.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GroupIcon size={20} color="white" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {muted.group.includes(g.id) && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                          {lastMsg && <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{formatTime(lastMsg.created_at)}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {lastMsg
                            ? (lastMsg.sender === 'SYSTEM' ? lastMsg.message
                              : lastMsg.sender === user.username ? `Tu: ${lastMsg.message}` : `${dn(lastMsg.sender)}: ${lastMsg.message}`)
                            : <em style={{ fontStyle: 'italic', opacity: 0.7 }}>{g.members?.length || 0} membri</em>}
                        </span>
                        {unread > 0 && (
                          <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                            {unread > 9 ? '9+' : unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DM CONVERSATION */}
          {view === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'chatSlideFromRight 0.2s ease' }}>
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 70, lineHeight: 1.8 }}>
                    Niciun mesaj cu {dn(peer?.username)}.<br/><span style={{ fontSize: 20 }}>👋</span>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.username === user.username;
                  const nextSame = i < messages.length - 1 && messages[i + 1].username === msg.username;
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4 }}>
                      <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word' }}>
                        {renderMessageText(msg.message, user.username)}
                      </div>
                      {!nextSame && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                          <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>
                          {isMe && <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>{isRead(msg) ? <SeenIcon /> : <SentIcon />}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>
              <ChatInput inputRef={inputRef} value={inputVal} onChange={handleInputChange}
                onKeyDown={handleKeyDown} onSend={sendMessage}
                placeholder={`Mesaj pentru ${dn(peer?.username)}...`}
                mentionQuery={mentionQuery} mentionUsers={mentionUsers}
                mentionHighlight={mentionHighlight} onMentionSelect={insertMention}
              />
            </div>
          )}

          {/* GROUP CONVERSATION */}
          {view === 'group-chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'chatSlideFromRight 0.2s ease' }}>
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groupMsgs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 70, lineHeight: 1.8 }}>
                    Niciun mesaj în „{activeGroup?.name}".<br/><span style={{ fontSize: 20 }}>💬</span>
                  </div>
                )}
                {groupMsgs.map((msg, i) => {
                  if (msg.message_type === 'system') {
                    return (
                      <div key={msg.id || `sys-${i}`} style={{ textAlign: 'center', padding: '6px 14px' }}>
                        <span style={{ fontSize: 11, color: 'var(--gray-4)', fontStyle: 'italic', background: 'var(--gray-1)', borderRadius: 10, padding: '3px 10px' }}>
                          {msg.message}
                        </span>
                      </div>
                    );
                  }
                  const isMe    = msg.username === user.username;
                  const nextMsg = groupMsgs[i + 1];
                  const prevMsg = groupMsgs[i - 1];
                  const nextSame = nextMsg && nextMsg.username === msg.username && nextMsg.message_type !== 'system';
                  const prevSame = prevMsg && prevMsg.username === msg.username && prevMsg.message_type !== 'system';
                  const seenBy  = getSeenBy(i, groupMsgs, memberReads[activeGroup?.id], user.username);
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4 }}>
                      {!isMe && !prevSame && (
                        <div style={{ fontSize: 11, color: '#ff7a3d', marginBottom: 3, paddingLeft: 4, fontWeight: 600 }}>{dn(msg.username)}</div>
                      )}
                      <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word' }}>
                        {renderMessageText(msg.message, user.username)}
                      </div>
                      {!nextSame && (
                        <div style={{ marginTop: 2, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                          <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>
                        </div>
                      )}
                      {seenBy.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: isMe ? 'flex-end' : 'flex-start', paddingRight: isMe ? 4 : 0, paddingLeft: isMe ? 0 : 4 }}>
                          {seenBy.map(uname => (
                            <div key={uname} title={`Văzut de ${uname}`}
                              style={{ width: 14, height: 14, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 7, fontWeight: 700, cursor: 'default' }}>
                              {uname.charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>
              <ChatInput inputRef={inputRef} value={inputVal} onChange={handleInputChange}
                onKeyDown={handleKeyDown} onSend={sendMessage}
                placeholder={`Mesaj în ${activeGroup?.name}...`}
                mentionQuery={mentionQuery} mentionUsers={mentionUsers}
                mentionHighlight={mentionHighlight} onMentionSelect={insertMention}
              />
            </div>
          )}

          {/* CREATE GROUP */}
          {view === 'create-group' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'chatSlideFromRight 0.2s ease' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                <input ref={newGroupNameRef} type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Numele grupului..." maxLength={60}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                  onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                />
                <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 5 }}>
                  {newGroupMembers.length === 0 ? 'Selectează cel puțin un membru' : `${newGroupMembers.length} membri selectați`}
                </div>
              </div>
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {orgUsers.map(u => (
                  <Checkbox key={u.username} checked={newGroupMembers.includes(u.username)} onChange={() => toggleCreateMember(u.username)} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username} />
                ))}
              </div>
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setView('contacts')}
                  style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Anulează
                </button>
                <button onClick={submitCreateGroup} disabled={!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving}
                  style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                  {groupSaving ? 'Se creează...' : 'Creează grup'}
                </button>
              </div>
            </div>
          )}

          {/* GROUP MEMBERS (admin: edit / non-admin: view) */}
          {view === 'group-members' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'chatSlideFromRight 0.2s ease' }}>
              {isAdmin && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                  <input type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)}
                    placeholder="Numele grupului..." maxLength={60}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'}
                    onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                  />
                </div>
              )}
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {isAdmin ? (
                  orgUsers.map(u => (
                    <Checkbox key={u.username} checked={editGroupMembers.includes(u.username)} onChange={() => toggleEditMember(u.username)} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username} />
                  ))
                ) : (
                  (activeGroup?.members || []).map(uname => (
                    <div key={uname} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 16 }}>
                          {uname.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: isOnline(uname) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--bg-page)' }}/>
                      </div>
                      <span style={{ fontSize: 14, color: 'var(--black)', flex: 1 }}>{dn(uname)}{dn(uname) !== uname ? <span style={{ fontSize: 11, color: 'var(--gray-4)', marginLeft: 5 }}>@{uname}</span> : null}</span>
                      {isOnline(uname) && <span style={{ fontSize: 11, color: '#22c55e' }}>online</span>}
                    </div>
                  ))
                )}
              </div>
              {isAdmin && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={deleteGroup}
                    style={{ padding: '9px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--red)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                    </svg>
                    Șterge
                  </button>
                  <button onClick={submitEditMembers} disabled={editGroupMembers.length === 0 || groupSaving}
                    style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, background: (editGroupMembers.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (editGroupMembers.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                    {groupSaving ? 'Se salvează...' : 'Salvează'}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
