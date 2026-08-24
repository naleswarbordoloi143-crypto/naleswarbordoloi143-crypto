import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AIConversation, AIMessage } from '@/lib/types';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Send, MessageCircle, Sparkles } from 'lucide-react';

const SUGGESTIONS_EN = [
  'What fertilizer should I use for wheat?',
  'When is the best time to irrigate rice?',
  'How to prevent pest attacks on cotton?',
  'What is the market trend for soybean?',
];

const SUGGESTIONS_HI = [
  'गेहूं के लिए कौन सा उर्वरक इस्तेमाल करें?',
  'धान की सिंचाई का सही समय कब है?',
  'कपास पर कीट आक्रमण कैसे रोकें?',
  'सोयाबीन का बाजार रुझान क्या है?',
];

export default function AIAssistantPage() {
  const { profile, t, language } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConv, setActiveConv] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setConversations((data as AIConversation[]) ?? []);
      if (data && data.length > 0) {
        setActiveConv(data[0]);
      }
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (!activeConv) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', activeConv.id)
        .order('created_at', { ascending: true });
      setMessages((data as AIMessage[]) ?? []);
    })();
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const newConversation = async () => {
    if (!profile) return;
    const { data, error: e } = await supabase.from('ai_conversations').insert({
      user_id: profile.id, title: 'New Conversation', language,
    }).select().single();
    if (e) { setError(e.message); return; }
    const conv = data as AIConversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
  };

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || !profile || sending) return;

    let conv = activeConv;
    if (!conv) {
      const { data, error: e } = await supabase.from('ai_conversations').insert({
        user_id: profile.id, title: content.slice(0, 40), language,
      }).select().single();
      if (e) { setError(e.message); return; }
      conv = data as AIConversation;
      setActiveConv(conv);
      setConversations((prev) => [conv!, ...prev]);
    }

    setSending(true);
    setInput('');

    // Save user message
    const { data: userMsg } = await supabase.from('ai_messages').insert({
      conversation_id: conv.id, role: 'user', content,
    }).select().single();
    if (userMsg) setMessages((prev) => [...prev, userMsg as AIMessage]);

    // Build context
    const context = `Farmer: ${profile.full_name}, Village: ${profile.village}, District: ${profile.district}, State: ${profile.state}. Language: ${language === 'hi' ? 'Hindi' : 'English'}.`;

    // Get location coordinates for real-time weather
    let lat: number | undefined;
    let lon: number | undefined;
    const { data: village } = await supabase
      .from('villages')
      .select('latitude, longitude')
      .ilike('name', profile.village || '')
      .maybeSingle();
    if (village?.latitude && village?.longitude) {
      lat = village.latitude;
      lon = village.longitude;
    } else {
      const { data: farm } = await supabase
        .from('farms')
        .select('latitude, longitude')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (farm?.latitude && farm?.longitude) {
        lat = farm.latitude;
        lon = farm.longitude;
      }
    }

    // Build conversation history for context
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content });

    // Call edge function
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: history, context, language, lat, lon }),
      });

      let reply: string;
      if (res.ok) {
        const data = await res.json();
        reply = data.reply || data.error || 'I could not process your request right now.';
      } else {
        reply = 'AI service is not available right now. Please try again later.';
      }

      // Save AI message
      const { data: aiMsg } = await supabase.from('ai_messages').insert({
        conversation_id: conv.id, role: 'assistant', content: reply,
      }).select().single();
      if (aiMsg) setMessages((prev) => [...prev, aiMsg as AIMessage]);
    } catch {
      const fallback = 'AI service is not available right now. Please try again later.';
      const { data: aiMsg } = await supabase.from('ai_messages').insert({
        conversation_id: conv.id, role: 'assistant', content: fallback,
      }).select().single();
      if (aiMsg) setMessages((prev) => [...prev, aiMsg as AIMessage]);
    }

    setSending(false);
  };

  if (loading) return <CardSpinner />;

  const suggestions = language === 'hi' ? SUGGESTIONS_HI : SUGGESTIONS_EN;

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-140px)]">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary-600 rounded-xl text-white"><Sparkles size={24} /></div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">{t('aiAssistant')}</h2>
          <p className="text-sm text-stone-500">Your AI farming companion — ask anything</p>
        </div>
      </div>

      <div className="flex gap-4 h-full">
        {/* Conversations sidebar */}
        <div className="hidden md:flex flex-col w-64 bg-white rounded-2xl border border-stone-200 p-3 overflow-y-auto">
          <button onClick={newConversation} className="btn-primary w-full mb-3 text-sm">New Chat</button>
          {conversations.length === 0 ? (
            <EmptyState icon={<MessageCircle size={28} />} title="No chats" className="py-6" />
          ) : (
            conversations.map((c) => (
              <button key={c.id} onClick={() => setActiveConv(c)}
                className={`text-left px-3 py-2 rounded-xl text-sm mb-1 transition-colors ${activeConv?.id === c.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-stone-100 text-stone-600'}`}>
                {c.title}
              </button>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 rounded-2xl bg-primary-50 text-primary-600 mb-4"><Sparkles size={40} /></div>
                <h3 className="text-lg font-bold text-stone-700">Ask Kishan Bhai AI</h3>
                <p className="text-sm text-stone-400 mb-6 max-w-md">Get personalized farming advice on crops, fertilizer, irrigation, market prices and more</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)} className="text-left p-3 rounded-xl border border-stone-200 hover:border-primary-300 hover:bg-primary-50 text-sm text-stone-600 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-stone-100 text-stone-700 rounded-bl-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-stone-100 p-3 flex gap-2">
            <input
              className="input-field flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your question..."
              disabled={sending}
            />
            <button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="btn-primary">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
}
