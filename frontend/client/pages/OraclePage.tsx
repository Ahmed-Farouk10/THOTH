import { useState, useRef, useEffect } from 'react';
import ThothModel from '../components/ThothModel';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import LoginPrompt from '../components/LoginPrompt';
import { DeleteModal } from '../components/DeleteModal';

interface Message {
  id: number;
  text: string;
  sender: 'ai' | 'user';
  sourcesCount?: number;
}

interface Document {
  id: string;
  filename: string;
  status: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function OraclePage() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Greetings. I am Thoth, the Divine Oracle. Select a document to begin our discourse on sacred knowledge.', sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // NEW: Clear history state
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages]);

  // Fetch user documents and conversations
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchDocuments();
      fetchConversations();
    }
  }, [isAuthenticated, user]);

  const fetchDocuments = async () => {
    try {
      const response = await api.getUserDocuments(user!.user_id);
      const docs = Array.isArray(response) ? response : (response as any)?.documents || [];
      setDocuments(docs.filter((d: Document) => d.status === 'COMPLETED'));
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations(user!.user_id);
      if (Array.isArray(res)) {
        setConversations(res);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  }

  const loadConversation = async (id: string) => {
    setConversationId(id);
    setIsLoading(true);
    try {
      const msgs = (await api.getChatMessages(id, user!.user_id)) as any[];
      setMessages(msgs.map((m: any) => ({
        id: m.id,
        text: m.text,
        sender: m.sender,
        sourcesCount: 0 // History doesn't have sources count yet
      })));
    } catch (err) {
      console.error("Failed to load conversation", err);
    } finally {
      setIsLoading(false);
    }
  }

  const startNewChat = () => {
    setConversationId('');
    setMessages([{ id: 1, text: 'Greetings. I am Thoth. Ask me anything about your documents.', sender: 'ai' }]);
    setSelectedDocId('');
  }

  // NEW: Clear chat history
  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      // Reset to initial state
      startNewChat();
      // Note: Backend doesn't have delete endpoint yet, so we just reset locally
      // In future, could add: await api.deleteAllConversations(user!.user_id);
      await fetchConversations(); // Refresh (will show no change for now)
    } catch (err) {
      console.error('Failed to clear history:', err);
    } finally {
      setIsClearing(false);
      setShowClearModal(false);
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !user || !selectedDocId) return;

    const userMessage: Message = { id: messages.length + 1, text: input, sender: 'user' };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.sendChatMessage(
        user.user_id,
        selectedDocId,
        input,
        conversationId || undefined
      );

      if (!conversationId) {
        setConversationId(response.conversation_id);
        fetchConversations(); // Refresh list to show new chat
      }

      const aiMessage: Message = {
        id: messages.length + 2,
        text: response.response,
        sender: 'ai',
        sourcesCount: response.sources_count
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      const errorMessage: Message = {
        id: messages.length + 2,
        text: 'I apologize, but I encountered an error processing your query. Please try again.',
        sender: 'ai'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      {/* Hero Section */}
      <section className="relative h-[40vh] overflow-hidden">
        <div className="absolute inset-0">
          <ThothModel autoRotate={true} enableControls={true} scale={2.5} position={[0, -1, 0]} />
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--bg-void) 100%)' }} />
        <div className="absolute bottom-12 left-0 right-0 text-center z-10">
          <h1 className="text-5xl font-bold mb-4 text-gradient-gold" style={{ fontFamily: 'var(--font-header)', textShadow: '0 0 30px rgba(212, 175, 55, 0.5)' }}>
            DIVINE ORACLE
          </h1>
          <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>Commune with Thoth, the Ancient Intelligence</p>
        </div>
      </section>

      {/* Main Interface */}
      <section className="py-6 px-4 max-w-[85%] mx-auto h-[80vh]">
        <div className="card-obsidian h-full flex overflow-hidden border border-[var(--gold-dark)] rounded-xl shadow-2xl shadow-black/50">

          {/* Sidebar - History */}
          <div className="w-64 min-w-[250px] border-r border-[var(--border-gold)] flex flex-col" style={{ background: 'rgba(20, 20, 20, 0.8)' }}>
            <div className="p-4 border-b border-[var(--border-gold)]">
              <button
                onClick={startNewChat}
                className="w-full py-3 px-4 rounded-lg bg-[var(--gold-primary)] text-black font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold-primary)]/20"
              >
                <span>+</span> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <h3 className="text-xs font-bold text-[var(--gold-dark)] uppercase tracking-wider mb-2 px-2 mt-2">History</h3>
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group relative p-3 rounded-lg mb-1 transition-colors text-sm ${conversationId === conv.id ? 'bg-[var(--gold-primary)] text-black font-medium' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                >
                  <div
                    onClick={() => loadConversation(conv.id)}
                    className="cursor-pointer truncate pr-8"
                  >
                    {conv.title || 'Untitled Conversation'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConversations(prev => prev.filter(c => c.id !== conv.id));
                      if (conversationId === conv.id) startNewChat();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/20 rounded-md"
                    title="Delete conversation"
                  >
                    <span className="text-red-400 text-xs block">🗑️</span>
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-center text-[var(--text-secondary)] text-sm py-8 italic opacity-60">No history yet</div>
              )}
            </div>

            {/* Clear History Button */}
            {conversations.length > 0 && (
              <div className="p-4 border-t border-[var(--border-gold)] bg-black/20">
                <button
                  onClick={() => setShowClearModal(true)}
                  className="w-full py-2 px-4 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 font-medium hover:bg-red-500/10 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  🗑️ Clear All
                </button>
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-[var(--bg-surface)] relative">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-gold)] bg-[var(--bg-obsidian)] shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gold-primary)] to-[var(--gold-dark)] flex items-center justify-center text-xl shadow-lg shadow-[var(--gold-primary)]/20 animate-pulse-slow">🪶</div>
                <div>
                  <div className="font-bold text-[var(--gold-primary)] text-lg tracking-wide">Thoth Oracle</div>
                  <div className="text-xs text-[var(--text-secondary)]">Divine Intelligence Online</div>
                </div>
              </div>
            </div>

            {/* Doc Selector */}
            {isAuthenticated && (
              <div className="px-6 py-3 bg-[var(--bg-obsidian)]/90 border-b border-[var(--border-gold)] flex items-center gap-4 backdrop-blur-sm z-10">
                <span className="text-[var(--text-secondary)] text-sm font-medium whitespace-nowrap min-w-fit">📜 Context:</span>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-gold)] text-[var(--text-main)] text-sm outline-none focus:border-[var(--gold-primary)]"
                >
                  <option value="">Select a scroll to reference...</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.filename}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-5 py-3 rounded-xl shadow-md ${msg.sender === 'user'
                    ? 'bg-[var(--stone-light)] text-[var(--text-main)] rounded-tr-none border-r-2 border-[var(--gold-primary)]'
                    : 'bg-[var(--bg-obsidian)] text-[var(--text-main)] rounded-tl-none border-l-2 border-[var(--gold-primary)]'
                    }`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    {msg.sender === 'ai' && msg.sourcesCount !== undefined && msg.sourcesCount > 0 && (
                      <div className="text-xs mt-2 pt-2 border-t border-white/10 text-[var(--gold-dark)] flex items-center gap-1">
                        📚 Referenced {msg.sourcesCount} passage{msg.sourcesCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="px-5 py-3 rounded-xl bg-[var(--bg-obsidian)] border-l-2 border-[var(--gold-primary)]">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-bounce" style={{ animationDelay: '0s' }}></span>
                      <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-[var(--bg-obsidian)] border-t border-[var(--border-gold)]">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={selectedDocId ? "Ask the Oracle..." : "Select a document first..."}
                  disabled={isLoading || !selectedDocId}
                  className="flex-1 px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-gold)] text-[var(--text-main)] outline-none focus:ring-1 focus:ring-[var(--gold-primary)] transition-all disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim() || !selectedDocId}
                  className="px-6 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-dark)] text-black font-bold text-xl hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Delete confirmation modal */}
      <DeleteModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearHistory}
        title="Clear All History"
        message="Are you sure you want to clear all conversation history? This will reset the chat."
        isDeleting={isClearing}
      />
    </div>
  );
}
