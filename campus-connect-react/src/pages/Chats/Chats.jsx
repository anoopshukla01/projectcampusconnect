import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Chats.css';

const CATEGORY_ICONS = { official: '📢', subject: '📚', private: '👥', direct: '💬' };

export default function Chats() {
  const { user } = useAuth();
  const showToast = useToast();
  const msgRef = useRef(null);

  // Fetch conversations (rooms) list
  const { data: apiData, loading, error, isEmpty, refetch: refetchRooms } = useApiData('/api/v1/career/chats', { rooms: [] });

  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  
  // Modal states
  const [showStartModal, setShowStartModal] = useState(false);
  const [startStep, setStartStep] = useState('menu'); // 'menu' | 'direct_student' | 'direct_professor' | 'create_group' | 'join_group'
  
  // Directory & form data
  const [contacts, setContacts] = useState({ students: [], professors: [] });
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedInviteIds, setSelectedInviteIds] = useState([]);
  const [joinGroupId, setJoinGroupId] = useState('');
  
  // Group Admin actions state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminAction, setAdminAction] = useState(null); // null | 'add' | 'promote'
  const [adminTargetUserId, setAdminTargetUserId] = useState('');

  // Sync rooms list from apiData
  useEffect(() => {
    if (apiData?.rooms) {
      setRooms(apiData.rooms);
    }
  }, [apiData]);

  // Load message history when active room changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const fetchMessages = async (showLoading = false) => {
      if (showLoading) setLoadingMessages(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/career/chats/${activeId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch messages');
        const data = await res.json();
        if (isMounted) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (showLoading && isMounted) setLoadingMessages(false);
      }
    };

    fetchMessages(true);

    // Poll messages every 3 seconds for real-time simulation
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (msgRef.current) {
      msgRef.current.scrollTop = msgRef.current.scrollHeight;
    }
  }, [messages]);

  // Load contacts for start conversation
  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/contacts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch contacts');
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      showToast('Could not load campus directory.', 'error');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleOpenStartModal = () => {
    setStartStep('menu');
    setSearchQuery('');
    setGroupName('');
    setSelectedInviteIds([]);
    setJoinGroupId('');
    setShowStartModal(true);
  };

  const handleSelectMenuOption = (step) => {
    setStartStep(step);
    if (step === 'direct_student' || step === 'direct_professor' || step === 'create_group') {
      loadContacts();
    }
  };

  // Create Direct Chat
  const startDirectChat = async (recipientId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'direct', recipient_id: recipientId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start chat');
      
      showToast('Conversation started', 'success');
      setActiveId(data.conversation_id);
      setShowStartModal(false);
      refetchRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Create Private Group
  const createPrivateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'private',
          name: groupName.trim(),
          invited_user_ids: selectedInviteIds
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      showToast(`Group "${groupName}" created!`, 'success');
      setActiveId(data.conversation_id);
      setShowStartModal(false);
      refetchRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Join Group by ID
  const joinGroupById = async (e) => {
    e.preventDefault();
    if (!joinGroupId.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversation_id: joinGroupId.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join group');

      showToast(`Joined group "${data.name || 'Private Group'}"`, 'success');
      setActiveId(data.conversation_id);
      setShowStartModal(false);
      refetchRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeId) return;

    const currentText = messageText.trim();
    setMessageText('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/career/chats/${activeId}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: currentText })
      });
      if (!res.ok) throw new Error('Failed to send message');
      const newMsg = await res.json();
      setMessages(prev => [...prev, newMsg]);
      refetchRooms();
    } catch (err) {
      showToast('Failed to send message', 'error');
      setMessageText(currentText);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversation_id: activeId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to leave group');
      }
      showToast('Left group successfully', 'success');
      setActiveId(null);
      refetchRooms();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Add Member Admin action
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!adminTargetUserId) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/members/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversation_id: activeId, user_id: adminTargetUserId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add member');
      }
      showToast('Member added successfully', 'success');
      setAdminTargetUserId('');
      setAdminAction(null);
      setShowAdminPanel(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Promote Member Admin action
  const handlePromoteMember = async (e) => {
    e.preventDefault();
    if (!adminTargetUserId) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/career/chats/members/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversation_id: activeId, user_id: adminTargetUserId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to promote member');
      }
      showToast('Member promoted to co-admin successfully', 'success');
      setAdminTargetUserId('');
      setAdminAction(null);
      setShowAdminPanel(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Filter contacts by search query
  const filteredStudents = contacts.students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProfessors = contacts.professors.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeChat = rooms.find(r => r.id === activeId);

  return (
    <div className="chats-layout">
      {/* Sidebar panel */}
      <aside className="chats-list-panel panel" aria-label="Conversations">
        <div className="chats-list-header">
          <h1 className="page-title" style={{ fontSize: '1.1rem', margin: 0 }}>Messages</h1>
          <button className="action-btn start-conv-btn" onClick={handleOpenStartModal}>
            ➕ Start Chat
          </button>
        </div>
        <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No active chats. Start one below!">
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rooms.map(r => (
              <li key={r.id}>
                <button className={`chat-item${activeId === r.id ? ' active' : ''}`} onClick={() => setActiveId(r.id)}>
                  <div className="chat-avatar">{CATEGORY_ICONS[r.type] || '💬'}</div>
                  <div className="chat-item-body">
                    <div className="chat-item-row">
                      <span className="chat-name">{r.name}</span>
                      <span className="chat-time">{r.lastTime || ''}</span>
                    </div>
                    <span className="chat-preview">{r.lastMessage || 'No messages yet'}</span>
                  </div>
                  {r.unread && <span className="chat-dot" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </StateContainer>
      </aside>

      {/* Main chat window */}
      <section className="chat-window panel" aria-label="Active chat messages">
        {!activeChat ? (
          <div className="chat-empty">
            <span style={{ fontSize: '2.5rem' }}>💬</span>
            <h3>Stay connected with Campus</h3>
            <p style={{ color: 'var(--clr-muted)', fontSize: '0.85rem' }}>
              Select a room from the sidebar, or click <strong>Start Chat</strong> to find students or professors.
            </p>
          </div>
        ) : (
          <>
            {/* Active chat header */}
            <div className="chat-window-header">
              <div className="chat-avatar-lg">{CATEGORY_ICONS[activeChat.type]}</div>
              <div style={{ flex: 1 }}>
                <div className="chat-window-name">{activeChat.name}</div>
                <div className="chat-window-meta">
                  {activeChat.type.toUpperCase()} GROUP
                  {activeChat.class_code && ` · ${activeChat.class_code}`}
                  {activeChat.user_role && ` · Role: ${activeChat.user_role.toUpperCase()}`}
                </div>
              </div>
              
              {/* Private Group Actions */}
              {activeChat.type === 'private' && (
                <div className="group-actions-container">
                  <button className="action-btn btn-sm" onClick={() => setShowAdminPanel(!showAdminPanel)}>
                    ⚙️ Group Info
                  </button>
                  {showAdminPanel && (
                    <div className="group-admin-dropdown">
                      <div className="dropdown-section">
                        <strong>Group Actions</strong>
                        <button className="dropdown-item text-danger" onClick={handleLeaveGroup}>
                          Leave Group
                        </button>
                      </div>

                      {/* Admin-only actions */}
                      {(activeChat.user_role === 'admin' || activeChat.user_role === 'co_admin') && (
                        <div className="dropdown-section mt-2">
                          <strong>Admin Options</strong>
                          <button className="dropdown-item" onClick={() => { setAdminAction('add'); loadContacts(); }}>
                            Add Member
                          </button>
                          <button className="dropdown-item" onClick={() => { setAdminAction('promote'); loadContacts(); }}>
                            Promote to Co-Admin
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin actions mini forms */}
            {activeChat.type === 'private' && adminAction && (
              <div className="admin-action-bar">
                <form onSubmit={adminAction === 'add' ? handleAddMember : handlePromoteMember}>
                  <label>
                    Select User to {adminAction === 'add' ? 'Add' : 'Promote'}:
                    <select
                      value={adminTargetUserId}
                      onChange={e => setAdminTargetUserId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose student --</option>
                      {contacts.students.map(s => (
                        <option key={s.user_id} value={s.user_id}>{s.name} ({s.roll})</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="action-btn btn-sm">Confirm</button>
                  <button type="button" className="action-btn btn-sm secondary" onClick={() => setAdminAction(null)}>Cancel</button>
                </form>
              </div>
            )}

            {/* Messages box */}
            <div className="chat-messages" ref={msgRef}>
              {loadingMessages ? (
                <div className="chat-empty">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="chat-empty">No messages yet. Say hello!</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`message${m.out ? ' outgoing' : ''}`}>
                    {!m.out && <span className="msg-sender">{m.sender}</span>}
                    <div className="msg-bubble">{m.text}</div>
                    <span className="msg-time">{m.time}</span>
                  </div>
                ))
              )}
            </div>

            {/* Input row */}
            <form className="chat-input-row" onSubmit={handleSendMessage}>
              <input
                className="chat-input"
                type="text"
                placeholder="Type a message…"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                aria-label="Type a message"
                required
              />
              <button type="submit" className="send-btn action-btn" disabled={!messageText.trim()} aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </>
        )}
      </section>

      {/* Start Conversation Modal */}
      {showStartModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal">
            <div className="chat-modal-header">
              <h3>
                {startStep === 'menu' && 'Start Conversation'}
                {startStep === 'direct_student' && 'Message a Student'}
                {startStep === 'direct_professor' && 'Message a Professor'}
                {startStep === 'create_group' && 'Create Private Group'}
                {startStep === 'join_group' && 'Join Group by ID'}
              </h3>
              <button className="close-btn" onClick={() => setShowStartModal(false)}>×</button>
            </div>
            
            <div className="chat-modal-content">
              {startStep === 'menu' && (
                <div className="menu-options-list">
                  <button className="menu-opt" onClick={() => handleSelectMenuOption('direct_student')}>
                    💬 Message a Student
                  </button>
                  <button className="menu-opt" onClick={() => handleSelectMenuOption('direct_professor')}>
                    🎓 Message a Professor
                  </button>
                  <button className="menu-opt" onClick={() => handleSelectMenuOption('create_group')}>
                    👥 Create Group
                  </button>
                  <button className="menu-opt" onClick={() => handleSelectMenuOption('join_group')}>
                    🔗 Join Group
                  </button>
                </div>
              )}

              {/* Direct Message - Students list */}
              {startStep === 'direct_student' && (
                <div>
                  <input
                    className="modal-search-input"
                    type="text"
                    placeholder="Search by name or roll number..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {loadingContacts ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>Loading directory...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--clr-muted)' }}>No students found</div>
                  ) : (
                    <div className="modal-scroll-list">
                      {filteredStudents.map(s => (
                        <button key={s.user_id} className="contact-list-item" onClick={() => startDirectChat(s.user_id)}>
                          <div><strong>{s.name}</strong></div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--clr-muted)' }}>{s.roll} · {s.branch}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="action-btn secondary mt-3" onClick={() => setStartStep('menu')}>Back</button>
                </div>
              )}

              {/* Direct Message - Professors list */}
              {startStep === 'direct_professor' && (
                <div>
                  <input
                    className="modal-search-input"
                    type="text"
                    placeholder="Search by name or designation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {loadingContacts ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>Loading directory...</div>
                  ) : filteredProfessors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--clr-muted)' }}>No professors found</div>
                  ) : (
                    <div className="modal-scroll-list">
                      {filteredProfessors.map(p => (
                        <button key={p.user_id} className="contact-list-item" onClick={() => startDirectChat(p.user_id)}>
                          <div><strong>{p.name}</strong></div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--clr-muted)' }}>{p.designation}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="action-btn secondary mt-3" onClick={() => setStartStep('menu')}>Back</button>
                </div>
              )}

              {/* Create Private Group form */}
              {startStep === 'create_group' && (
                <form onSubmit={createPrivateGroup}>
                  <label className="form-label">
                    Group Name:
                    <input
                      className="form-input mt-1"
                      type="text"
                      placeholder="E.g., Hackathon Team"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      required
                    />
                  </label>
                  
                  <label className="form-label mt-3">
                    Invite Students:
                    <div className="invite-selection-box mt-1">
                      {loadingContacts ? (
                        <div>Loading...</div>
                      ) : contacts.students.map(s => {
                        const isChecked = selectedInviteIds.includes(s.user_id);
                        return (
                          <label key={s.user_id} className="invite-checkbox-row">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedInviteIds(prev => prev.filter(id => id !== s.user_id));
                                } else {
                                  setSelectedInviteIds(prev => [...prev, s.user_id]);
                                }
                              }}
                            />
                            <span>{s.name} ({s.roll})</span>
                          </label>
                        );
                      })}
                    </div>
                  </label>

                  <div className="modal-footer-row mt-4">
                    <button type="button" className="action-btn secondary" onClick={() => setStartStep('menu')}>Back</button>
                    <button type="submit" className="action-btn" disabled={!groupName.trim()}>Create</button>
                  </div>
                </form>
              )}

              {/* Join Group form */}
              {startStep === 'join_group' && (
                <form onSubmit={joinGroupById}>
                  <label className="form-label">
                    Group ID / Invite Code:
                    <input
                      className="form-input mt-1"
                      type="text"
                      placeholder="Paste UUID here..."
                      value={joinGroupId}
                      onChange={e => setJoinGroupId(e.target.value)}
                      required
                    />
                  </label>
                  <p style={{ fontSize: '0.72rem', color: 'var(--clr-muted)', marginTop: '0.5rem' }}>
                    Paste the conversation UUID shared by the group administrator.
                  </p>

                  <div className="modal-footer-row mt-4">
                    <button type="button" className="action-btn secondary" onClick={() => setStartStep('menu')}>Back</button>
                    <button type="submit" className="action-btn" disabled={!joinGroupId.trim()}>Join</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
