/**
 * CampusCopilot Component (Refined & Workable)
 * ============================================
 * Context-Aware AI Assistant Floating Widget for Campus Connect:
 * - Direct function-calling integration for Attendance, Schedule, Notices, CR/CS, Placements, Assignments.
 * - Interactive action buttons to jump directly to app routes.
 * - Copy code snippets with 1-click clipboard integration.
 * - Voice Input (Speech-to-Text) & Voice Output (Read Aloud).
 * - Persistent message history in localStorage.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Trash2,
  Minimize2,
  Maximize2,
  Activity,
  Calendar,
  Megaphone,
  Code,
  BookOpen,
  CheckCircle2,
  Search,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  Check,
  ArrowRight,
  Briefcase,
  FileText,
} from 'lucide-react';
import { copilotApi } from '../../services/api';
import './CampusCopilot.css';

const QUICK_ACTIONS = [
  { label: 'My Attendance %', icon: '📊', prompt: 'What is my current attendance percentage and safe bunk margin?' },
  { label: "Today's Timetable", icon: '📅', prompt: "Show me today's class timetable and room allocations." },
  { label: 'Placement Drives', icon: '💼', prompt: 'Show active campus placement drives, CTC packages, and eligibility.' },
  { label: 'Pending Assignments', icon: '📝', prompt: 'Do I have any pending assignments or lab submissions due?' },
  { label: 'Latest Notices', icon: '📢', prompt: 'Summarize the latest official campus notices and announcements.' },
  { label: 'Who is our CR?', icon: '👑', prompt: 'Who is the active Class Representative (CR) for my batch?' },
  { label: "Dijkstra's Code", icon: '💻', prompt: "Explain Dijkstra's shortest path algorithm with Python code." },
  { label: 'Quick Sort', icon: '⚡', prompt: 'Explain Quick Sort algorithm with Python implementation.' },
];

export default function CampusCopilot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState(null);

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('cc_copilot_messages');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "👋 Hi! I'm your **Campus Connect Copilot**.\n\nI can assist with **live attendance & bunk calculations**, **daily timetables**, **placement drives**, **assignments**, and **DSA / engineering coding concepts**.\n\nClick a suggestion chip below, type a query, or tap the 🎙️ mic to speak!",
        tool_used: null,
        timestamp: new Date().toISOString(),
      },
    ];
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cc_copilot_messages', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Handle Speech Recognition (Web Speech API)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSpeak = (msgId, text) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner speech
    const cleanText = text.replace(/[*#`_>\[\]]/g, '').replace(/```[\s\S]*?```/g, 'Code block omitted.');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyCode = (codeText, idx) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2500);
  };

  const handleSend = async (textToSend = null) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await copilotApi.chat(newMessages);
      if (res && res.content) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: res.content,
            tool_used: res.tool_used,
            action: res.action,
            timestamp: res.timestamp || new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I could not process that request. Please try again.',
            tool_used: null,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error('Copilot chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Network error communicating with Copilot backend.',
          tool_used: null,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingMsgId(null);
    const resetMsg = [
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: "Chat cleared! How can I assist with your campus academics or coding doubts today?",
        tool_used: null,
        timestamp: new Date().toISOString(),
      },
    ];
    setMessages(resetMsg);
    localStorage.removeItem('cc_copilot_messages');
  };

  // Markdown-like parser
  const renderMessageContent = (text, msgId) => {
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'text', code: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return parts.map((part, idx) => {
      const codeId = `${msgId}-code-${idx}`;
      if (part.type === 'code') {
        const isCopied = copiedCodeIdx === codeId;
        return (
          <div key={idx} className="cc-code-block">
            <div className="cc-code-header">
              <span className="cc-code-lang">{part.lang}</span>
              <button
                className="cc-copy-btn"
                onClick={() => handleCopyCode(part.code, codeId)}
                title="Copy code to clipboard"
              >
                {isCopied ? (
                  <>
                    <Check size={12} className="text-green" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="cc-code-pre">
              <code>{part.code}</code>
            </pre>
          </div>
        );
      }

      const lines = part.content.split('\n');
      return (
        <div key={idx} className="cc-text-part">
          {lines.map((line, lIdx) => {
            if (line.startsWith('### ')) {
              return <h4 key={lIdx} className="cc-msg-h4">{line.replace('### ', '')}</h4>;
            }
            if (line.startsWith('#### ')) {
              return <h5 key={lIdx} className="cc-msg-h5">{line.replace('#### ', '')}</h5>;
            }
            if (line.startsWith('- ')) {
              return <li key={lIdx} className="cc-msg-li">{parseInline(line.replace('- ', ''))}</li>;
            }
            if (line.startsWith('> ')) {
              return <blockquote key={lIdx} className="cc-msg-quote">{parseInline(line.replace('> ', ''))}</blockquote>;
            }
            if (line.trim() === '') {
              return <div key={lIdx} style={{ height: '0.4rem' }} />;
            }
            return <p key={lIdx} className="cc-msg-p">{parseInline(line)}</p>;
          })}
        </div>
      );
    });
  };

  const parseInline = (str) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let last = 0;
    let match;

    while ((match = boldRegex.exec(str)) !== null) {
      if (match.index > last) {
        parts.push(parseCodeInline(str.substring(last, match.index)));
      }
      parts.push(<strong key={match.index}>{match[1]}</strong>);
      last = match.index + match[0].length;
    }
    if (last < str.length) {
      parts.push(parseCodeInline(str.substring(last)));
    }
    return parts;
  };

  const parseCodeInline = (str) => {
    const codeRegex = /`([^`]+)`/g;
    const parts = [];
    let last = 0;
    let match;
    while ((match = codeRegex.exec(str)) !== null) {
      if (match.index > last) {
        parts.push(str.substring(last, match.index));
      }
      parts.push(<code key={match.index} className="cc-inline-code">{match[1]}</code>);
      last = match.index + match[0].length;
    }
    if (last < str.length) {
      parts.push(str.substring(last));
    }
    return parts;
  };

  return (
    <>
      {/* ── Floating Action Button (FAB) ─────────────────────────────────── */}
      {!isOpen && (
        <button
          className="cc-fab"
          onClick={() => setIsOpen(true)}
          title="Open Campus Connect Copilot"
          aria-label="Open AI Copilot"
        >
          <div className="cc-fab-glow" />
          <div className="cc-fab-inner">
            <Sparkles size={20} className="cc-fab-icon" />
            <span className="cc-fab-label">AI Copilot</span>
          </div>
        </button>
      )}

      {/* ── Expandable Floating Chat Drawer ──────────────────────────────── */}
      {isOpen && (
        <div className={`cc-drawer ${isExpanded ? 'cc-drawer--expanded' : ''}`}>
          {/* Header */}
          <div className="cc-header">
            <div className="cc-header-info">
              <div className="cc-ai-avatar">
                <Bot size={18} />
                <span className="cc-status-dot" />
              </div>
              <div>
                <h3 className="cc-title">Campus Copilot</h3>
                <span className="cc-subtitle">Context-Aware Academic AI</span>
              </div>
            </div>

            <div className="cc-header-actions">
              <button
                className="cc-icon-btn"
                onClick={handleClear}
                title="Clear conversation"
              >
                <Trash2 size={15} />
              </button>
              <button
                className="cc-icon-btn"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore' : 'Expand window'}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                className="cc-icon-btn cc-close-btn"
                onClick={() => {
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  setSpeakingMsgId(null);
                  setIsOpen(false);
                }}
                title="Close Copilot (ESC)"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="cc-chips-scroll">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                className="cc-chip"
                onClick={() => handleSend(action.prompt)}
                disabled={loading}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Chat Messages Log */}
          <div className="cc-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`cc-message-row ${msg.role === 'user' ? 'cc-msg-user' : 'cc-msg-assistant'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="cc-msg-avatar">
                    <Sparkles size={14} />
                  </div>
                )}

                <div className="cc-msg-bubble">
                  {/* Tool execution badge if used */}
                  {msg.tool_used && (
                    <div className="cc-tool-badge">
                      {msg.tool_used === 'get_student_attendance' && (
                        <>
                          <Activity size={12} /> Live Attendance System Tool
                        </>
                      )}
                      {msg.tool_used === 'get_today_schedule' && (
                        <>
                          <Calendar size={12} /> Timetable Database Engine
                        </>
                      )}
                      {msg.tool_used === 'get_recent_broadcasts' && (
                        <>
                          <Megaphone size={12} /> Official Campus Notice Board
                        </>
                      )}
                      {msg.tool_used === 'get_placement_drives' && (
                        <>
                          <Briefcase size={12} /> Placement Portal Service
                        </>
                      )}
                      {msg.tool_used === 'get_active_assignments' && (
                        <>
                          <FileText size={12} /> Academic Assignments Tracker
                        </>
                      )}
                      {msg.tool_used === 'get_delegation_info' && (
                        <>
                          <CheckCircle2 size={12} /> Student Privileges Registry
                        </>
                      )}
                      {msg.tool_used === 'academic_knowledge_reasoning' && (
                        <>
                          <Search size={12} /> Academic & Coding Reasoning
                        </>
                      )}
                    </div>
                  )}

                  <div className="cc-msg-content">
                    {renderMessageContent(msg.content, msg.id)}
                  </div>

                  {/* Interactive Action Button */}
                  {msg.action && (
                    <div className="cc-action-box">
                      <button
                        className="cc-action-btn"
                        onClick={() => {
                          setIsOpen(false);
                          navigate(msg.action.target);
                        }}
                      >
                        <span>{msg.action.label}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* Footer toolbar: Timestamp + Speak Button */}
                  <div className="cc-msg-footer">
                    {msg.role === 'assistant' && (
                      <button
                        className="cc-speak-btn"
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        title={speakingMsgId === msg.id ? 'Stop reading' : 'Read aloud'}
                      >
                        {speakingMsgId === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                    )}
                    <span className="cc-msg-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="cc-message-row cc-msg-assistant">
                <div className="cc-msg-avatar">
                  <Sparkles size={14} />
                </div>
                <div className="cc-msg-bubble cc-msg-loading">
                  <span className="cc-dot" />
                  <span className="cc-dot" />
                  <span className="cc-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="cc-input-wrap">
            <button
              className={`cc-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              title={isListening ? 'Listening... click to stop' : 'Voice Input (Click to speak)'}
              type="button"
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <textarea
              ref={inputRef}
              className="cc-input"
              rows={1}
              placeholder={isListening ? 'Listening to your voice...' : 'Ask about attendance, timetable, notices, or coding doubts...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              className="cc-send-btn"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              title="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
