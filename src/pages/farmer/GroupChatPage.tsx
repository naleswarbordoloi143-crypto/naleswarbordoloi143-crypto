import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { ChatGroup, ChatMessage } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { CardSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';
import {
  Plus, Send, MessageCircle, Pin, Megaphone, Trash,
  Users, ChevronLeft, AlertCircle, Search,
} from 'lucide-react';

interface MessageWithProfile extends ChatMessage {
  profiles?: { full_name: string } | null;
}

export default function GroupChatPage() {
  const { profile, t } = useAuth();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [showGroupList, setShowGroupList] = useState(false);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load groups
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('chat_groups')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const groupList = (data as ChatGroup[]) ?? [];
        setGroups(groupList);
        if (groupList.length > 0) setActiveGroup(groupList[0]);
      } catch (e: any) {
        setMsgError(e.message || 'Failed to load groups');
      }
      setLoading(false);
    })();
  }, [profile]);

  // Load member counts for all groups
  useEffect(() => {
    if (groups.length === 0) return;
    (async () => {
      const counts: Record<string, number> = {};
      for (const g of groups) {
        const { count } = await supabase
          .from('chat_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id);
        counts[g.id] = count ?? 0;
      }
      setMemberCounts(counts);
    })();
  }, [groups]);

  // Load messages + realtime subscription
  useEffect(() => {
    if (!activeGroup) {
      setMessages([]);
      return;
    }
    setMsgError(null);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*, profiles!chat_messages_user_id_profiles_fkey(full_name)')
          .eq('group_id', activeGroup.id)
          .order('created_at', { ascending: true })
          .limit(100);
        if (error) throw error;
        setMessages((data as MessageWithProfile[]) ?? []);
      } catch (e: any) {
        setMsgError(e.message || 'Failed to load messages');
      }
    })();

    const channel = supabase
      .channel(`chat-${activeGroup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${activeGroup.id}`,
        },
        (payload) => {
          (async () => {
            const newMsg = payload.new as ChatMessage;
            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newMsg.user_id)
              .maybeSingle();
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, { ...newMsg, profiles: prof }];
            });
          })();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${activeGroup.id}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${activeGroup.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...(payload.new as ChatMessage) } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGroup]);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createGroup = async () => {
    if (!profile || !groupName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('chat_groups')
        .insert({ name: groupName.trim(), description: groupDesc.trim(), created_by: profile.id })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from('chat_members')
        .insert({ group_id: data.id, user_id: profile.id, role: 'admin' });

      setGroups((prev) => [data as ChatGroup, ...prev]);
      setMemberCounts((prev) => ({ ...prev, [data.id]: 1 }));
      setActiveGroup(data as ChatGroup);
      setShowModal(false);
      setGroupName('');
      setGroupDesc('');
    } catch (e: any) {
      alert(e.message || 'Failed to create group');
    }
    setCreating(false);
  };

  const sendMessage = useCallback(async (type: 'text' | 'announcement' = 'text') => {
    if (!profile || !activeGroup || !input.trim()) return;
    const content = input.trim();
    setInput('');
    setSendError(null);
    inputRef.current?.focus();

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          group_id: activeGroup.id,
          user_id: profile.id,
          type,
          content,
        });
      if (error) throw error;
    } catch (e: any) {
      setSendError(e.message || 'Failed to send message');
      setInput(content);
    }
  }, [profile, activeGroup, input]);

  const pinMessage = async (msg: MessageWithProfile) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_pinned: !msg.is_pinned })
        .eq('id', msg.id);
    } catch {
      // RLS may block if not owner — champion pinning is handled by UPDATE policy
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await supabase.from('chat_messages').delete().eq('id', id).eq('user_id', profile?.id || '');
      // Realtime DELETE event will remove from state
    } catch (e: any) {
      // silently fail — RLS blocks if not owner
    }
  };

  if (loading) return <CardSpinner />;

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Group Chat</h2>
          <p className="text-sm text-stone-500">Connect with farmers in your village</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={18} /> New Group
        </button>
      </div>

      <div className="flex gap-4 h-full min-h-0">
        {/* Group list — sidebar on desktop, drawer on mobile */}
        <div className={`${showGroupList ? 'flex' : 'hidden'} md:flex flex-col w-56 bg-white rounded-2xl border border-stone-200 p-3 overflow-y-auto flex-shrink-0 absolute md:relative inset-0 z-20 md:z-0 bg-stone-50 md:bg-white`}>
          <div className="flex items-center justify-between mb-2 md:hidden">
            <span className="font-bold text-stone-700">Groups</span>
            <button onClick={() => setShowGroupList(false)} className="p-1 rounded-lg hover:bg-stone-200">
              <ChevronLeft size={18} />
            </button>
          </div>
          {groups.length === 0 ? (
            <EmptyState icon={<MessageCircle size={28} />} title="No groups" className="py-6" />
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setActiveGroup(g);
                  setShowGroupList(false);
                }}
                className={`text-left px-3 py-2.5 rounded-xl text-sm mb-1 transition-colors ${
                  activeGroup?.id === g.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-stone-100 text-stone-600'
                }`}
              >
                <p className="font-semibold truncate">{g.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Users size={11} className="text-stone-400" />
                  <span className="text-xs text-stone-400">{memberCounts[g.id] ?? 0} members</span>
                </div>
                {g.description && <p className="text-xs text-stone-400 truncate mt-0.5">{g.description}</p>}
              </button>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-stone-200 overflow-hidden min-w-0">
          {activeGroup ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
                <button
                  onClick={() => setShowGroupList(true)}
                  className="md:hidden p-1 rounded-lg hover:bg-stone-100"
                >
                  <ChevronLeft size={20} className="text-stone-500" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-800 truncate">{activeGroup.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Users size={11} /> {memberCounts[activeGroup.id] ?? 0} members
                    </span>
                    {activeGroup.description && (
                      <span className="text-xs text-stone-400 truncate">· {activeGroup.description}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {msgError ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <AlertCircle size={28} className="text-error-400" />
                    <p className="text-sm text-stone-500">{msgError}</p>
                    <button
                      onClick={() => setMsgError(null)}
                      className="text-xs font-semibold text-primary-600 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    icon={<MessageCircle size={32} />}
                    title="No messages yet"
                    description="Start the conversation"
                    className="py-8"
                  />
                ) : (
                  <>
                    {/* Pinned messages first */}
                    {messages.filter((m) => m.is_pinned).length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {messages.filter((m) => m.is_pinned).map((m) => (
                          <div key={`pinned-${m.id}`} className="flex items-center gap-2 px-3 py-1.5 bg-accent-50 rounded-lg border border-accent-100">
                            <Pin size={12} className="text-accent-500 flex-shrink-0" />
                            <p className="text-xs text-accent-700 truncate flex-1">{m.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* All messages */}
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${m.user_id === profile?.id ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                            m.type === 'announcement'
                              ? 'bg-accent-100 border border-accent-200'
                              : m.user_id === profile?.id
                              ? 'bg-primary-600 text-white'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {m.type === 'announcement' && (
                            <Megaphone size={14} className="inline mr-1 text-accent-600" />
                          )}
                          <p className={`text-xs font-semibold mb-0.5 ${m.user_id === profile?.id ? 'text-white/70' : 'text-stone-500'}`}>
                            {m.profiles?.full_name || 'Farmer'}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-stone-400">{timeAgo(m.created_at)}</span>
                          {m.user_id === profile?.id && (
                            <button
                              onClick={() => deleteMessage(m.id)}
                              className="text-stone-300 hover:text-error-500 transition-colors"
                            >
                              <Trash size={12} />
                            </button>
                          )}
                          {(profile?.active_role || profile?.role) === 'champion' && (
                            <button
                              onClick={() => pinMessage(m)}
                              className={`transition-colors ${m.is_pinned ? 'text-accent-500' : 'text-stone-300 hover:text-accent-500'}`}
                            >
                              <Pin size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </>
                )}
              </div>

              {/* Send error */}
              {sendError && (
                <div className="px-4 py-1.5 bg-error-50 border-t border-error-100 flex items-center gap-2">
                  <AlertCircle size={14} className="text-error-500" />
                  <p className="text-xs text-error-600 flex-1">{sendError}</p>
                  <button onClick={() => setSendError(null)} className="text-xs text-error-400 hover:text-error-600">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="border-t border-stone-100 p-3 flex gap-2">
                <input
                  ref={inputRef}
                  className="input-field flex-1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                />
                {(profile?.active_role || profile?.role) === 'champion' && (
                  <button
                    onClick={() => sendMessage('announcement')}
                    disabled={!input.trim()}
                    className="btn-secondary"
                    title="Send announcement"
                  >
                    <Megaphone size={18} />
                  </button>
                )}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="btn-primary"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<MessageCircle size={40} />}
                title="No group selected"
                description="Create a new group to start chatting"
              />
            </div>
          )}
        </div>
      </div>

      {/* New Group Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Group" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label-text">Group Name</label>
            <input
              className="input-field"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Rampur Farmers"
              onKeyDown={(e) => e.key === 'Enter' && createGroup()}
            />
          </div>
          <div>
            <label className="label-text">Description</label>
            <input
              className="input-field"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="For farmers in Rampur village"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowModal(false)} className="btn-ghost">
              {t('cancel')}
            </button>
            <button
              onClick={createGroup}
              disabled={!groupName.trim() || creating}
              className="btn-primary"
            >
              {creating ? 'Creating...' : t('create')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
