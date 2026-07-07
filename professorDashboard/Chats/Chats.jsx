import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Chats.css';

const CATEGORY_ICONS = { official:'📢', subject:'📚', peer:'👥', direct:'💬' };

const BASE_CHATS = [
  { id:'off-dept', name:'CS Announcements', category:'official', meta:'Managed by Department Office', unread:true, messages:[
    { sender:'Dr. Vikram Singh', text:'Mid-semester lab examination schedule has been uploaded. Please verify your slots.', time:'10:30 AM', out:false },
    { sender:'Office of CS', text:'All students must clear dues before Nov 30 to download registration cards.', time:'11:15 AM', out:false },
  ]},
  { id:'off-placement', name:'Placement Alerts', category:'official', meta:'Placement Cell Official', unread:false, messages:[
    { sender:'Placement Coordinator', text:'TCS on-campus drive registrations close tonight. Apply via the Career tab.', time:'Yesterday', out:false },
    { sender:'Placement Coordinator', text:'Google Summer of Code info session is scheduled for 5 PM in LH-108.', time:'3h ago', out:false },
  ]},
  { id:'sub-1', name:'networks-class', category:'subject', meta:'Class Discussion', unread:false, messages:[
    { sender:'Rahul', text:'Has anyone finished the assignment due this weekend?', time:'2:15 PM', out:false },
    { sender:'Dr. Sneha Patel', text:'Please submit the simulation script as a zip file. PDF report is mandatory.', time:'3:00 PM', out:false },
  ]},
  { id:'sub-2', name:'software-eng', category:'subject', meta:'Subject Q&A', unread:true, messages:[
    { sender:'Priya', text:'Does anyone have the slides for Module 3?', time:'4:20 PM', out:false },
    { sender:'Rohan Mehra', text:'I uploaded them in the Notes section.', time:'4:45 PM', out:false },
  ]},
  { id:'group-peer', name:'Hackathon Hyperion 4.0', category:'peer', meta:'4 members', unread:false, messages:[
    { sender:'Arjun', text:"Let's meet in the library cafeteria at 4 PM to finalize our project deck.", time:'12:00 PM', out:false },
    { sender:'Rahul', text:"Sounds good, I'll bring my laptop.", time:'12:10 PM', out:false },
    { sender:'You', text:'Perfect, see you guys there!', time:'12:15 PM', out:true },
  ]},
  { id:'direct-prof', name:'Dr. Sneha Patel', category:'direct', meta:'Professor', unread:false, messages:[
    { sender:'Dr. Sneha Patel', text:'Regarding your query about the research project, please meet me tomorrow during visiting hours.', time:'Yesterday', out:false },
  ]},
];

export default function Chats() {
  const { user }  = useAuth();
  const showToast = useToast();
  const [chats, setChats]     = useState(BASE_CHATS);
  const [active, setActive]   = useState(null);
  const [message, setMessage] = useState('');
  const msgRef = useRef(null);

  useEffect(() => { if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight; }, [active]);

  function openChat(id) {
    setChats(p=>p.map(c=>c.id===id?{...c,unread:false}:c));
    setActive(id);
  }

  function sendMsg(e) {
    e.preventDefault();
    if (!message.trim() || !active) return;
    setChats(p=>p.map(c=>c.id===active?{...c,messages:[...c.messages,{sender:'You',text:message.trim(),time:'Now',out:true}]}:c));
    setMessage('');
  }

  const activeChat = chats.find(c=>c.id===active);
  const unreadTotal = chats.filter(c=>c.unread).length;

  return (
    <div className="chats-layout">
      {/* Sidebar list */}
      <aside className="chats-list-panel panel" aria-label="Chat list">
        <div className="chats-list-header">
          <h1 className="page-title" style={{fontSize:'1rem'}}>Messages</h1>
          {unreadTotal>0 && <span className="unread-badge">{unreadTotal} new</span>}
        </div>
        <ul role="list" style={{listStyle:'none'}}>
          {chats.map(c=>(
            <li key={c.id}>
              <button className={`chat-item${active===c.id?' active':''}`} onClick={()=>openChat(c.id)}>
                <div className="chat-avatar">{CATEGORY_ICONS[c.category]}</div>
                <div className="chat-item-body">
                  <div className="chat-item-row">
                    <span className="chat-name">{c.name}</span>
                    <span className="chat-time">{c.messages.at(-1)?.time}</span>
                  </div>
                  <span className="chat-preview">{c.messages.at(-1)?.text}</span>
                </div>
                {c.unread && <span className="chat-dot" aria-hidden="true"/>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Message area */}
      <section className="chat-window panel" aria-label="Chat messages">
        {!activeChat ? (
          <div className="chat-empty">
            <span style={{fontSize:'2rem'}}>💬</span>
            <p>Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <div className="chat-window-header">
              <div className="chat-avatar-lg">{CATEGORY_ICONS[activeChat.category]}</div>
              <div><div className="chat-window-name">{activeChat.name}</div><div className="chat-window-meta">{activeChat.meta}</div></div>
            </div>
            <div className="chat-messages" ref={msgRef}>
              {activeChat.messages.map((m,i)=>(
                <div key={i} className={`message${m.out?' outgoing':''}`}>
                  {!m.out && <span className="msg-sender">{m.sender}</span>}
                  <div className="msg-bubble">{m.text}</div>
                  <span className="msg-time">{m.time}</span>
                </div>
              ))}
            </div>
            <form className="chat-input-row" onSubmit={sendMsg}>
              <input
                className="chat-input" type="text" placeholder="Type a message…"
                value={message} onChange={e=>setMessage(e.target.value)}
                aria-label="Type a message"
              />
              <button type="submit" className="send-btn action-btn" disabled={!message.trim()} aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
