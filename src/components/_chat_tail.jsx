
      {/* ── Right Sidebar ─────────────────────────────────── */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 9900,
        width: SW, background: 'var(--surface)', borderLeft: '1px solid var(--gray-2)',
        display: 'flex', flexDirection: 'column', transition: 'width 0.22s ease',
        fontFamily: "'SF Pro Display', -apple-system, sans-serif", overflow: 'hidden',
      }}>
        {/* Sidebar Header */}
        <div style={{ height: 52, borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, flexShrink: 0, position: 'relative' }}>
          <button onClick={() => { const v = !sidebarCollapsed; setSidebarCollapsed(v); localStorage.setItem('chat_sidebar_collapsed', v); }}
            title={sidebarCollapsed ? 'Extinde chat' : 'Restrânge chat'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--gray-4)', display: 'flex', alignItems: 'center', transition: 'background 0.15s, color 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--black)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
            {sidebarCollapsed
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            }
          </button>
          {!sidebarCollapsed && (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', flex: 1 }}>Mesaje</span>
              <span style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{onlineUsers.filter(u => u !== user.username).length} online</span>
              {totalUnread > 0 && (
                <button title="Marchează tot citit" onClick={() => { axios.put('/api/chat/read-all', {}, { headers }).catch(() => {}); setUnreadCounts({}); setGroupUnread({}); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 6, display: 'flex', alignItems: 'center', color: 'var(--gray-4)', transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--green)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                </button>
              )}
            </>
          )}
          {sidebarCollapsed && totalUnread > 0 && (
            <div style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: 'white', borderRadius: '50%', minWidth: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box' }}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          )}
        </div>

        {/* Sidebar Body */}
        {sidebarCollapsed ? (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4 }}>
            {orgUsers.map(u => {
              const unread = unreadCounts[u.username] || 0;
              const online = isOnline(u.username);
              return (
                <div key={u.username} onClick={() => openConversation(u)} title={dn(u.username)}
                  style={{ position: 'relative', cursor: 'pointer', padding: '4px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14 }}>
                    {(u.first_name || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ position: 'absolute', bottom: 4, right: 6, width: 9, height: 9, borderRadius: '50%', background: online ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                  {unread > 0 && <div style={{ position: 'absolute', top: 2, right: 4, background: '#ff7a3d', color: 'white', borderRadius: '50%', minWidth: 14, height: 14, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', boxSizing: 'border-box' }}>{unread > 9 ? '9+' : unread}</div>}
                </div>
              );
            })}
            {groups.map(g => {
              const unread = groupUnread[g.id] || 0;
              return (
                <div key={g.id} onClick={() => openGroupConversation(g)} title={g.name}
                  style={{ position: 'relative', cursor: 'pointer', padding: '4px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: groupColor(g.name), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GroupIcon size={16} color="white"/>
                  </div>
                  {unread > 0 && <div style={{ position: 'absolute', top: 2, right: 4, background: '#ff7a3d', color: 'white', borderRadius: '50%', minWidth: 14, height: 14, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', boxSizing: 'border-box' }}>{unread > 9 ? '9+' : unread}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {view === 'contacts' && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută după nume..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'} onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}/>
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                </div>
              </div>
            )}

            {(view === 'create-group' || view === 'group-members' || view === 'group-add-members') && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gray-1)', flexShrink: 0 }}>
                <BackBtn onClick={goBack}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)' }}>
                    {view === 'create-group' ? 'Grup nou' : view === 'group-add-members' ? 'Adaugă membri' : (
                      groupRenaming
                        ? <input autoFocus type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} onBlur={submitRenameGroup} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitRenameGroup(); } if (e.key === 'Escape') { setGroupRenaming(false); setEditGroupName(activeGroup?.name || ''); } }} maxLength={60} style={{ width: '100%', boxSizing: 'border-box', padding: '2px 6px', border: '1px solid #ff7a3d', borderRadius: 5, fontSize: 14, fontWeight: 600, background: 'var(--bg-page)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}/>
                        : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeGroup?.name}</span>{isAdmin && <button onClick={() => { setEditGroupName(activeGroup?.name || ''); setGroupRenaming(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 4 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--black)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-4)'}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 1 }}>
                    {view === 'create-group' ? (newGroupMembers.length === 0 ? 'Selectează cel puțin un membru' : `${newGroupMembers.length} membri selectați`) : view === 'group-add-members' ? (addMemberSel.length === 0 ? 'Selectează utilizatori' : `${addMemberSel.length} selectați`) : `${activeGroup?.members?.length || 0} membri`}
                  </div>
                </div>
              </div>
            )}

            {view === 'contacts' && (
              <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <div onClick={toggleDm} style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>Mesaje directe {dmCollapsed && filteredUsers.length > 0 ? `(${filteredUsers.length})` : ''}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5" style={{ transform: dmCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div style={{ overflow: 'hidden', maxHeight: dmCollapsed ? '0px' : '5000px', opacity: dmCollapsed ? 0 : 1, transition: 'max-height 0.32s ease, opacity 0.22s ease' }}>
                  {filteredUsers.length === 0 && !search && <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, padding: '12px 14px' }}>Niciun coleg în organizație.</div>}
                  {filteredUsers.map((u, i) => {
                    const last = lastMessages[u.username], unread = unreadCounts[u.username] || 0, online = isOnline(u.username);
                    const isMutedDm = muted.dm.includes(u.username);
                    const showMuteBtn = hoveredDm === u.username || isMutedDm;
                    return (
                      <div key={u.username} onClick={() => openConversation(u)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; setHoveredDm(u.username); }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setHoveredDm(null); }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14 }}>{(u.first_name || u.username).charAt(0).toUpperCase()}</div>
                          <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: online ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)', transition: 'background 0.3s' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dn(u.username)}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); toggleMuteDm(u.username); }} title={isMutedDm ? 'Activează notificări' : 'Silențios'}
                                style={{ visibility: showMuteBtn ? 'visible' : 'hidden', background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px', color: isMutedDm ? 'var(--gray-4)' : 'var(--gray-3)', display: 'flex', alignItems: 'center', borderRadius: 5 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {isMutedDm ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
                              </button>
                              {last && <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(last.created_at)}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 11, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {last ? (last.sender === user.username ? `Tu: ${last.message}` : last.message) : <em style={{ opacity: 0.7 }}>{roleLabel(u.role)}</em>}
                            </span>
                            {unread > 0 && <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(!search || filteredGroups.length > 0) && (
                  <div style={{ borderTop: filteredUsers.length > 0 ? '1px solid var(--gray-2)' : 'none' }}>
                    <div onClick={toggleGrps} style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>Grupuri {grpsCollapsed && filteredGroups.length > 0 ? `(${filteredGroups.length})` : ''}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {canChat('chatCreateGroup') && <button onClick={e => { e.stopPropagation(); openCreateGroup(); }} title="Grup nou" style={{ background: 'transparent', border: '1px solid var(--gray-3)', borderRadius: 6, cursor: 'pointer', padding: '2px 7px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nou</button>}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2.5" style={{ transform: grpsCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ overflow: 'hidden', maxHeight: grpsCollapsed ? '0px' : '5000px', opacity: grpsCollapsed ? 0 : 1, transition: 'max-height 0.32s ease, opacity 0.22s ease' }}>
                  {filteredGroups.length === 0 && !search && <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 12, padding: '10px 14px 16px', fontStyle: 'italic' }}>{isAdmin ? 'Niciun grup creat.' : 'Nu ești în niciun grup.'}</div>}
                  {filteredGroups.map((g, i) => {
                    const unread = groupUnread[g.id] || 0, lastMsg = g._lastMsg;
                    const isMutedGrp = muted.group.includes(g.id);
                    const showMuteGrp = hoveredGroup === g.id || isMutedGrp;
                    return (
                      <div key={g.id} onClick={() => openGroupConversation(g)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < filteredGroups.length - 1 ? '1px solid var(--gray-2)' : 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; setHoveredGroup(g.id); }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setHoveredGroup(null); }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: groupColor(g.name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GroupIcon size={17} color="white"/></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); toggleMuteGroup(g.id); }} title={isMutedGrp ? 'Activează notificări' : 'Silențios'}
                                style={{ visibility: showMuteGrp ? 'visible' : 'hidden', background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px 4px', color: isMutedGrp ? 'var(--gray-4)' : 'var(--gray-3)', display: 'flex', alignItems: 'center', borderRadius: 5 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {isMutedGrp ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
                              </button>
                              {lastMsg && <span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(lastMsg.created_at)}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 11, color: unread > 0 ? 'var(--black)' : 'var(--gray-4)', fontWeight: unread > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {lastMsg ? (lastMsg.sender === 'SYSTEM' ? lastMsg.message : lastMsg.sender === user.username ? `Tu: ${lastMsg.message}` : `${dn(lastMsg.sender)}: ${lastMsg.message}`) : <em style={{ opacity: 0.55 }}>Niciun mesaj încă</em>}
                            </span>
                            {unread > 0 && <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'create-group' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-2)', flexShrink: 0 }}>
                  <input ref={newGroupNameRef} type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Numele grupului..." maxLength={60}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 14, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ff7a3d'} onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}/>
                </div>
                <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {orgUsers.map(u => <Checkbox key={u.username} checked={newGroupMembers.includes(u.username)} onChange={() => toggleCreateMember(u.username)} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username}/>)}
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setView('contacts')} style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Anulează</button>
                  <button onClick={submitCreateGroup} disabled={!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving}
                    style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (!newGroupName.trim() || newGroupMembers.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                    {groupSaving ? 'Se creează...' : 'Creează grup'}
                  </button>
                </div>
              </div>
            )}

            {view === 'group-members' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
                {memberMenuOpen && <div onClick={() => setMemberMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }}/>}
                <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {(activeGroup?.members || []).map(uname => (
                    <div key={uname} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', transition: 'background 0.12s', position: 'relative' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 13 }}>{uname.charAt(0).toUpperCase()}</div>
                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: isOnline(uname) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dn(uname)}{dn(uname) !== uname ? <span style={{ fontSize: 11, color: 'var(--gray-4)', marginLeft: 4 }}>@{uname}</span> : null}</div>
                        <div style={{ fontSize: 11, color: isOnline(uname) ? '#22c55e' : 'var(--gray-4)' }}>{isOnline(uname) ? 'online' : 'offline'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {canChat('chatManageMembers') && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', flexShrink: 0 }}>
                    <button onClick={() => setView('group-add-members')} style={{ width: '100%', padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>+ Adaugă membri</button>
                  </div>
                )}
              </div>
            )}

            {view === 'group-add-members' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {(() => {
                    const nonMembers = orgUsers.filter(u => !(activeGroup?.members || []).includes(u.username));
                    if (nonMembers.length === 0) return <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, padding: '28px 16px' }}>Toți utilizatorii sunt deja în grup.</div>;
                    return nonMembers.map(u => <Checkbox key={u.username} checked={addMemberSel.includes(u.username)} onChange={() => setAddMemberSel(prev => prev.includes(u.username) ? prev.filter(x => x !== u.username) : [...prev, u.username])} label={dn(u.username) !== u.username ? `${dn(u.username)} (@${u.username})` : u.username}/>);
                  })()}
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setView('group-members')} style={{ flex: 1, padding: '9px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--black)', fontFamily: 'inherit', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Anulează</button>
                  <button onClick={submitAddMembers} disabled={addMemberSel.length === 0 || groupSaving}
                    style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: (addMemberSel.length === 0 || groupSaving) ? 'var(--gray-2)' : '#ff7a3d', cursor: (addMemberSel.length === 0 || groupSaving) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'inherit' }}>
                    {groupSaving ? 'Se adaugă...' : `Adaugă${addMemberSel.length > 0 ? ` (${addMemberSel.length})` : ''}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Chat Cards ────────────────────────────────────── */}
      {openCards.map((card, idx) => {
        const cardW = 300;
        const rightOffset = SW + 8 + idx * (cardW + 8);
        const isActiveDm  = card.type === 'dm'    && peer?.username  === card.peer?.username;
        const isActiveGrp = card.type === 'group' && activeGroup?.id === card.group?.id;
        const isActive = isActiveDm || isActiveGrp;
        const cardUnread = card.type === 'dm' ? (unreadCounts[card.peer?.username] || 0) : (groupUnread[card.group?.id] || 0);
        return (
          <div key={card.key} style={{
            position: 'fixed', bottom: 0, right: rightOffset, zIndex: 9800, width: cardW,
            height: card.minimized ? 48 : 460,
            background: 'var(--surface)', border: '1px solid var(--gray-2)',
            borderRadius: '12px 12px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transition: 'height 0.2s ease',
            fontFamily: "'SF Pro Display', -apple-system, sans-serif",
          }}>
            {/* Card Header */}
            <div
              onClick={() => {
                if (card.minimized) {
                  setOpenCards(prev => prev.map(c => c.key === card.key ? { ...c, minimized: false } : c));
                  if (!isActive) { if (card.type === 'dm') openConversation(card.peer); else openGroupConversation(card.group); }
                } else {
                  minimizeCard(card.key);
                }
              }}
              style={{ height: 48, padding: '0 8px 0 12px', display: 'flex', alignItems: 'center', gap: 8, background: isActive ? 'var(--gray-1)' : 'var(--surface)', borderBottom: card.minimized ? 'none' : '1px solid var(--gray-2)', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
              {card.type === 'dm' ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(card.peer?.username || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 12 }}>
                    {(card.peer?.first_name || card.peer?.username || '').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: isOnline(card.peer?.username) ? '#22c55e' : 'var(--gray-3)', border: '2px solid var(--surface)' }}/>
                </div>
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: groupColor(card.group?.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <GroupIcon size={13} color="white"/>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.type === 'dm' ? dn(card.peer?.username) : card.group?.name}
                </div>
                {card.type === 'dm' && !card.minimized && (
                  <div style={{ fontSize: 10, color: isOnline(card.peer?.username) ? '#22c55e' : 'var(--gray-4)' }}>
                    {isOnline(card.peer?.username) ? 'online' : 'offline'}
                  </div>
                )}
              </div>
              {card.minimized && cardUnread > 0 && (
                <div style={{ background: '#ff7a3d', color: 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>{cardUnread > 9 ? '9+' : cardUnread}</div>
              )}
              <button onClick={e => { e.stopPropagation(); minimizeCard(card.key); }} title={card.minimized ? 'Extinde' : 'Minimizează'}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 5, transition: 'background 0.12s', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); closeCard(card.key); }} title="Închide"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', borderRadius: 5, transition: 'background 0.12s, color 0.12s', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-2)'; e.currentTarget.style.color = 'var(--red)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Card Body */}
            {!card.minimized && (
              isActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
                  {showSearch && (
                    <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-page)', flexShrink: 0 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gray-4)" strokeWidth="2" style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                          onKeyDown={e => { if (e.key === 'Enter') navigateSearch(e.shiftKey ? -1 : 1); if (e.key === 'Escape') toggleSearch(); }}
                          placeholder="Caută în conversație..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px 5px 25px', border: '1px solid var(--gray-3)', borderRadius: 7, fontSize: 12, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit' }}
                          onFocus={e => e.target.style.borderColor = '#ff7a3d'} onBlur={e => e.target.style.borderColor = 'var(--gray-3)'}/>
                      </div>
                      {searchQuery.trim() && <span style={{ fontSize: 11, color: 'var(--gray-4)', whiteSpace: 'nowrap' }}>{searchMatches.length > 0 ? `${searchIdx + 1}/${searchMatches.length}` : '0'}</span>}
                      <button onClick={toggleSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 3, display: 'flex', alignItems: 'center', borderRadius: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  )}
                  {pinnedMsg && (
                    <div onClick={scrollToPinned} style={{ padding: '5px 10px', borderBottom: '1px solid var(--gray-2)', background: 'var(--gray-1)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                      <div style={{ flex: 1, fontSize: 11, color: 'var(--gray-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ fontWeight: 600, color: 'var(--black)' }}>{pinnedMsg.username}</span>: {pinnedMsg.message}</div>
                      <button onClick={e => { e.stopPropagation(); handleUnpin(pinnedMsg); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  )}
                  <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }} onScroll={handleMsgsScroll}>
                    {card.type === 'dm' ? (
                      messages.length === 0
                        ? <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 50, lineHeight: 1.8 }}>Niciun mesaj cu {dn(peer?.username)}.<br/><span style={{ fontSize: 20 }}>👋</span></div>
                        : messages.map((msg, i) => {
                          if (msg.message_type === 'system') return <div key={msg.id || `s${i}`} style={{ textAlign: 'center', padding: '4px 10px' }}><span style={{ fontSize: 11, color: 'var(--gray-4)', fontStyle: 'italic', background: 'var(--gray-1)', borderRadius: 10, padding: '2px 8px' }}>{msg.message}</span></div>;
                          const isMe = msg.username === user.username;
                          const nextSame = i < messages.length - 1 && messages[i+1].username === msg.username && messages[i+1].message_type !== 'system';
                          const isHovered = hoveredMsgId === msg.id;
                          const isEditing = editingMsgId === msg.id;
                          const isSearchMatch = searchQuery.trim() && !msg.is_deleted && !isTripOrderMsg(msg) && msg.message?.toLowerCase().includes(searchQuery.toLowerCase());
                          const isCurrentSearchMatch = isSearchMatch && searchMatches[searchIdx] === i;
                          if (isTripOrderMsg(msg)) return (
                            <div key={msg.id} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, padding: '1px 2px' }}>
                              <TripOrderCard msg={msg} currentUser={user.username} onRespond={(status) => handleTripOrderRespond(msg, status)}/>
                              {!nextSame && <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexDirection: isMe ? 'row-reverse' : 'row' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>{isMe && <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>{isRead(msg) ? <SeenIcon/> : <SentIcon/>}</span>}</div>}
                            </div>
                          );
                          return (
                            <div key={msg.id}>
                              {msg.id === firstUnreadId && <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' }}><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/><span style={{ fontSize: 10, fontWeight: 600, color: '#ff7a3d', whiteSpace: 'nowrap' }}>MESAJE NOI</span><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/></div>}
                              <div id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, borderRadius: 8, animation: highlightedMsgId === msg.id ? 'msgHighlight 1.6s ease forwards' : 'none', padding: '1px 2px', outline: isCurrentSearchMatch ? '2px solid #ff7a3d' : isSearchMatch ? '1px solid rgba(255,122,61,0.4)' : 'none', outlineOffset: 2 }}
                                onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => setHoveredMsgId(null)}>
                                {msg.is_deleted ? (
                                  <div style={{ fontSize: 13, color: 'var(--gray-4)', fontStyle: 'italic', padding: '5px 9px', border: '1px solid var(--gray-2)', borderRadius: 10 }}>Mesaj șters</div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexDirection: isMe ? 'row' : 'row-reverse', maxWidth: '82%' }}>
                                    <div style={{ display: 'flex', gap: 2, opacity: isHovered && !isEditing ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: isHovered && !isEditing ? 'auto' : 'none' }}>
                                      <button onClick={() => setReplyTo({ id: msg.id, text: msg.message, username: msg.username })} title="Răspunde" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
                                      <button onClick={() => handlePin(msg)} title={msg.is_pinned ? 'Desprinde' : 'Prinde'} style={{ background: 'var(--surface)', border: `1px solid ${msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'}`, borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)'; e.currentTarget.style.borderColor = msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></button>
                                      {isMe && <>
                                        {Date.now() - new Date(msg.created_at).getTime() <= EDIT_LIMIT_MS && <button onClick={() => startEdit(msg)} title="Editează" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
                                        {canChat('chatDeleteMessage') && <button onClick={() => deleteMsg(msg)} title="Șterge" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>}
                                      </>}
                                    </div>
                                    {isEditing ? (
                                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg); } if (e.key === 'Escape') cancelEdit(); }} style={{ resize: 'none', border: '1.5px solid #ff7a3d', borderRadius: 8, padding: '5px 8px', fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, minWidth: 120 }}/>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                          <button onClick={cancelEdit} style={{ fontSize: 11, padding: '2px 7px', border: '1px solid var(--gray-3)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--gray-4)' }}>Anulează</button>
                                          <button onClick={() => submitEdit(msg)} style={{ fontSize: 11, padding: '2px 7px', border: 'none', borderRadius: 5, background: '#ff7a3d', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Salvează</button>
                                        </div>
                                      </div>
                                    ) : isImageMsg(msg) ? (
                                      <div style={{ padding: 3, borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setLightboxSrc(`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`)}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', padding: '2px 5px', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(255,122,61,0.08)', borderRadius: '0 4px 4px 0' }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        <img src={`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`} alt={msg.message || 'imagine'} style={{ display: 'block', maxWidth: 260, maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}/>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '7px 11px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: chatFontSize, lineHeight: 1.45, wordBreak: 'break-word' }}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', paddingLeft: 5, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        {renderMessageText(msg.message, user.username)}
                                        {msg.edited_at && <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 5 }}>(editat)</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!nextSame && !msg.is_deleted && <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span>{isMe && <span title={isRead(msg) ? 'Văzut' : 'Trimis'}>{isRead(msg) ? <SeenIcon/> : <SentIcon/>}</span>}</div>}
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      groupMsgs.length === 0
                        ? <div style={{ textAlign: 'center', color: 'var(--gray-4)', fontSize: 13, marginTop: 50, lineHeight: 1.8 }}>Niciun mesaj în „{activeGroup?.name}".<br/><span style={{ fontSize: 20 }}>💬</span></div>
                        : groupMsgs.map((msg, i) => {
                          if (msg.message_type === 'system') return <div key={msg.id || `sg${i}`} style={{ textAlign: 'center', padding: '4px 10px' }}><span style={{ fontSize: 11, color: 'var(--gray-4)', fontStyle: 'italic', background: 'var(--gray-1)', borderRadius: 10, padding: '2px 8px' }}>{msg.message}</span></div>;
                          const isMe = msg.username === user.username;
                          const nextMsg = groupMsgs[i+1], prevMsg = groupMsgs[i-1];
                          const nextSame = nextMsg && nextMsg.username === msg.username && nextMsg.message_type !== 'system';
                          const prevSame = prevMsg && prevMsg.username === msg.username && prevMsg.message_type !== 'system';
                          const seenBy = getSeenBy(i, groupMsgs, memberReads[activeGroup?.id], user.username);
                          const isHovered = hoveredMsgId === msg.id;
                          const isEditing = editingMsgId === msg.id;
                          const isSearchMatch = searchQuery.trim() && !msg.is_deleted && !isTripOrderMsg(msg) && msg.message?.toLowerCase().includes(searchQuery.toLowerCase());
                          const isCurrentSearchMatch = isSearchMatch && searchMatches[searchIdx] === i;
                          if (isTripOrderMsg(msg)) return (
                            <div key={msg.id} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, padding: '1px 2px' }}>
                              {!isMe && !prevSame && <div style={{ fontSize: 11, color: '#ff7a3d', marginBottom: 2, paddingLeft: 2, fontWeight: 600 }}>{dn(msg.username)}</div>}
                              <TripOrderCard msg={msg} currentUser={user.username} onRespond={(status) => handleTripOrderRespond(msg, status)}/>
                              {!nextSame && <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexDirection: isMe ? 'row-reverse' : 'row' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span></div>}
                            </div>
                          );
                          return (
                            <div key={msg.id}>
                              {msg.id === firstUnreadId && <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' }}><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/><span style={{ fontSize: 10, fontWeight: 600, color: '#ff7a3d', whiteSpace: 'nowrap' }}>MESAJE NOI</span><div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }}/></div>}
                              <div id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 1 : 4, borderRadius: 8, animation: highlightedMsgId === msg.id ? 'msgHighlight 1.6s ease forwards' : 'none', padding: '1px 2px', outline: isCurrentSearchMatch ? '2px solid #ff7a3d' : isSearchMatch ? '1px solid rgba(255,122,61,0.4)' : 'none', outlineOffset: 2 }}
                                onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => setHoveredMsgId(null)}>
                                {!isMe && !prevSame && !msg.is_deleted && <div style={{ fontSize: 11, color: '#ff7a3d', marginBottom: 2, paddingLeft: 2, fontWeight: 600 }}>{dn(msg.username)}</div>}
                                {msg.is_deleted ? (
                                  <div style={{ fontSize: 13, color: 'var(--gray-4)', fontStyle: 'italic', padding: '5px 9px', border: '1px solid var(--gray-2)', borderRadius: 10 }}>Mesaj șters</div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexDirection: isMe ? 'row' : 'row-reverse', maxWidth: '82%' }}>
                                    <div style={{ display: 'flex', gap: 2, opacity: isHovered && !isEditing ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: isHovered && !isEditing ? 'auto' : 'none' }}>
                                      <button onClick={() => setReplyTo({ id: msg.id, text: msg.message, username: msg.username })} title="Răspunde" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></button>
                                      <button onClick={() => handlePin(msg)} title={msg.is_pinned ? 'Desprinde' : 'Prinde'} style={{ background: 'var(--surface)', border: `1px solid ${msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'}`, borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = '#ff7a3d'; e.currentTarget.style.borderColor = '#ff7a3d'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = msg.is_pinned ? '#ff7a3d' : 'var(--gray-4)'; e.currentTarget.style.borderColor = msg.is_pinned ? '#ff7a3d' : 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg></button>
                                      {isMe && <>
                                        {Date.now() - new Date(msg.created_at).getTime() <= EDIT_LIMIT_MS && <button onClick={() => startEdit(msg)} title="Editează" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; e.currentTarget.style.borderColor = 'var(--gray-3)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
                                        {canChat('chatDeleteMessage') && <button onClick={() => deleteMsg(msg)} title="Șterge" style={{ background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 5, cursor: 'pointer', padding: '2px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-light)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>}
                                      </>}
                                    </div>
                                    {isEditing ? (
                                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg); } if (e.key === 'Escape') cancelEdit(); }} style={{ resize: 'none', border: '1.5px solid #ff7a3d', borderRadius: 8, padding: '5px 8px', fontSize: 13, background: 'var(--gray-1)', color: 'var(--black)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, minWidth: 120 }}/>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                          <button onClick={cancelEdit} style={{ fontSize: 11, padding: '2px 7px', border: '1px solid var(--gray-3)', borderRadius: 5, background: 'transparent', cursor: 'pointer', color: 'var(--gray-4)' }}>Anulează</button>
                                          <button onClick={() => submitEdit(msg)} style={{ fontSize: 11, padding: '2px 7px', border: 'none', borderRadius: 5, background: '#ff7a3d', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Salvează</button>
                                        </div>
                                      </div>
                                    ) : isImageMsg(msg) ? (
                                      <div style={{ padding: 3, borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setLightboxSrc(`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`)}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', padding: '2px 5px', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(255,122,61,0.08)', borderRadius: '0 4px 4px 0' }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        <img src={`data:${msg.image_type || 'image/png'};base64,${msg.image_data}`} alt={msg.message || 'imagine'} style={{ display: 'block', maxWidth: 260, maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}/>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '7px 11px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: isMe ? 'var(--chat-sent-bg)' : 'var(--chat-recv-bg)', color: isMe ? 'var(--chat-sent-text)' : 'var(--chat-recv-text)', fontSize: chatFontSize, lineHeight: 1.45, wordBreak: 'break-word' }}>
                                        {msg.reply_to_id && <div style={{ fontSize: 10, color: 'var(--gray-4)', borderLeft: '2px solid #ff7a3d', paddingLeft: 5, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}><span style={{ fontWeight: 600, color: '#ff7a3d' }}>{msg.reply_to_username}</span>: {sanitizeReplyText(msg.reply_to_text)}</div>}
                                        {renderMessageText(msg.message, user.username)}
                                        {msg.edited_at && <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 5 }}>(editat)</span>}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!nextSame && !msg.is_deleted && <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}><span style={{ fontSize: 10, color: 'var(--gray-4)' }}>{formatTime(msg.created_at)}</span></div>}
                                {seenBy.length > 0 && !msg.is_deleted && <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>{seenBy.map(uname => <div key={uname} title={`Văzut de ${uname}`} style={{ width: 12, height: 12, borderRadius: '50%', background: avatarColor(uname), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 7, fontWeight: 700 }}>{uname.charAt(0).toUpperCase()}</div>)}</div>}
                              </div>
                            </div>
                          );
                        })
                    )}
                    {card.type === 'dm' && typingUsers[`dm_${peer?.username}`] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', color: 'var(--gray-4)', fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 2 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gray-4)', animation: `typingDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}</div>
                        <span>{typingUsers[`dm_${peer?.username}`]} scrie...</span>
                      </div>
                    )}
                    {card.type === 'group' && typingUsers[`group_${activeGroup?.id}`] && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', color: 'var(--gray-4)', fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 2 }}>{[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gray-4)', animation: `typingDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}</div>
                        <span>{typingUsers[`group_${activeGroup?.id}`]} scrie...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef}/>
                  </div>
                  {pinNotification && (
                    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 10, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 12px rgba(0,0,0,0.14)', fontSize: 11, color: 'var(--black)', whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'chatItemIn 0.2s ease', zIndex: 2, pointerEvents: 'none' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{pinNotification}</span>
                    </div>
                  )}
                  {showScrollBtn && (
                    <button onClick={scrollToBottom} style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--gray-2)', borderRadius: 16, padding: '4px 12px 4px 8px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.14)', color: 'var(--gray-4)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', animation: 'chatItemIn 0.18s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.color = 'var(--black)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--gray-4)'; }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      Ultimul mesaj
                    </button>
                  )}
                  <ChatInput inputRef={inputRef} value={inputVal} onChange={handleInputChange}
                    onKeyDown={handleKeyDown} onSend={sendMessage}
                    placeholder={card.type === 'dm' ? `Mesaj pentru ${dn(peer?.username)}...` : `Mesaj în ${activeGroup?.name}...`}
                    mentionQuery={mentionQuery} mentionUsers={mentionUsers}
                    onOpenTripOrder={canChat('chatSendTripOrder') ? () => setTripOrderModal(true) : null}
                    onSendImage={sendImage}
                    mentionHighlight={mentionHighlight} onMentionSelect={insertMention}
                    replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-4)', fontSize: 13, cursor: 'pointer', flexDirection: 'column', gap: 8 }}
                  onClick={() => { if (card.type === 'dm') openConversation(card.peer); else openGroupConversation(card.group); }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gray-3)" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>Click pentru a activa</span>
                </div>
              )
            )}
          </div>
        );
      })}

      {/* ── Modals ─────────────────────────────────────────── */}
      {tripOrderModal && (
        <TripOrderModal
          peer={peer ? dn(peer.username) : null}
          groupName={activeGroup?.name || null}
          members={(activeGroup?.members || []).filter(m => m !== user.username)}
          dn={dn}
          onClose={() => setTripOrderModal(false)}
          onSend={sendTripOrder}
        />
      )}

      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', cursor: 'zoom-out', animation: 'chatItemIn 0.18s ease' }}>
          <img src={lightboxSrc} alt="imagine" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', objectFit: 'contain', cursor: 'default' }}/>
          <button onClick={() => setLightboxSrc(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <a href={lightboxSrc} download="imagine.png" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 18, right: 62, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
        </div>
      )}

      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-page)', border: '1px solid var(--gray-2)', borderRadius: 16, padding: '28px 28px 24px', width: 320, boxShadow: '0 16px 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
              <div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--black)', fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>Șterge mesaj</div><div style={{ fontSize: 12, color: 'var(--gray-4)', marginTop: 2 }}>Această acțiune nu poate fi anulată</div></div>
            </div>
            <div style={{ background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--gray-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isTripOrderMsg(deleteConfirm) ? '📦 Comandă de transport' : (deleteConfirm.is_deleted ? 'Mesaj șters' : deleteConfirm.message)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px 0', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--black)', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-2)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--gray-1)'}>Anulează</button>
              <button onClick={confirmDeleteMsg} style={{ flex: 1, padding: '10px 0', background: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#dc2626'} onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>Șterge</button>
            </div>
          </div>
        </div>
      )}

      {chatToast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 9700, background: chatToast.type === 'error' ? '#ef4444' : '#111110', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none', whiteSpace: 'nowrap', animation: 'fadeInUp 0.2s ease' }}>
          {chatToast.message}
        </div>
      )}
    </>
  );
}
