/**
 * CampusCopilot Component
 * =======================
 * Context-Aware AI Assistant Floating Widget for Campus Connect:
 * - Direct function-calling integration for Attendance, Schedule, Notices, CR/CS.
 * - Academic concept reasoning with formatted markdown & code blocks.
 * - Floating action drawer with quick-prompt chips.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Trash2,
  Minimize2,
  Maximize2,
  ChevronDown,
  Activity,
  Calendar,
  Megaphone,
  Code,
  BookOpen,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { copilotApi } from '../../services/api';
import './CampusCopilot.css';

const QUICK_ACTIONS = [
  { label: 'My Attendance %', icon: '📊', prompt: 'What is my current attendance percentage and safe bunk margin?' },
  { label: "Today's Timetable", icon: '📅', prompt: "Show me today's class timetable and room allocations." },
  { label: 'Latest Notices', icon: '📢', prompt: 'Summarize the latest official campus notices and announcements.' },
  { label: 'Who is our CR?', icon: '👑', prompt: 'Who is the active Class Representative (CR) for my batch?' },
  { label: "Dijkstra's Code", icon: '💻', prompt: "Explain Dijkstra's shortest path algorithm with Python code." },
];

export default function CampusCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "👋 Hi! I'm your **Campus Connect Copilot**.\n\nI can answer questions about your **attendance**, **class schedule**, **circulars**, or help explain **engineering & coding concepts**.\n\nTry clicking a quick prompt below or type your question!",
      tool_used: null,
      timestamp: new Date().toISOString(),
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

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
          content: '⚠️ Network connection error. Please verify your backend connection.',
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
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: "Chat cleared! How can I assist with your campus academics today?",
        tool_used: null,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Basic markdown-like parser for bold, code blocks, lists
  const renderMessageContent = (text) => {
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'text', code: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return parts.map((part, idx) => {
      if (part.type === 'code') {
        return (
          <div key={idx} className="cc-code-block">
            <div className="cc-code-header">
              <span>{part.lang}</span>
            </div>
            <pre className="cc-code-pre">
              <code>{part.code}</code>
            </pre>
          </div>
        );
      }

      // Convert line breaks and basic formatting
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
    // Bold **text**
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
                onClick={() => setIsOpen(false)}
                title="Close Copilot"
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
                    {renderMessageContent(msg.content)}
                  </div>

                  <span className="cc-msg-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
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
            <textarea
              ref={inputRef}
              className="cc-input"
              rows={1}
              placeholder="Ask about attendance, timetable, notices, or coding doubts..."
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
