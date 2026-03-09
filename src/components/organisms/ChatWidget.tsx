"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Minimize2,
  Users,
} from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { userIdAtom, unreadMessagesCountAtom, chatWidgetOpenAtom } from "@/store";
import { Button } from "@/components/atoms";

interface ConversationItem {
  id: string;
  name: string | null;
  isGroup: boolean;
  displayName: string;
  lastMessage: { id: string; content: string; createdAt: string; senderName: string } | null;
  otherParticipants: { id: string; name: string; avatarUrl: string | null }[];
  unreadCount: number;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  sender: { id: string; name: string; avatarUrl: string | null };
  attachments: { id: string; fileName: string; fileSize: number; mimeType: string; url: string }[];
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("es", { weekday: "short" });
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function ChatWidget() {
  const currentUserId = useAtomValue(userIdAtom);
  const unreadCount = useAtomValue(unreadMessagesCountAtom);
  const isOpen = useAtomValue(chatWidgetOpenAtom);
  const setChatWidgetOpen = useSetAtom(chatWidgetOpenAtom);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
  }, []);

  const loadMessages = useCallback(
    async () => {
      if (!selected) return;
      const res = await fetch(`/api/conversations/${selected.id}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages.reverse());
      }
    },
    [selected?.id]
  );

  useEffect(() => {
    if (!isOpen) return;
    loadConversations();
    setLoading(false);
  }, [isOpen, loadConversations]);

  useEffect(() => {
    if (selected && isOpen) {
      setMessages([]);
      loadMessages();
    }
  }, [selected?.id, isOpen, loadMessages]);

  useEffect(() => {
    if (!selected || !isOpen) return;
    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, [selected?.id, isOpen, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!selected || (!input.trim() && !sending)) return;
    const content = input.trim() || " ";
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setInput("");
        loadConversations();
      }
    } finally {
      setSending(false);
    }
  }

  function handleSelectConversation(c: ConversationItem) {
    setSelected(c);
    setView("chat");
  }

  function handleBack() {
    setSelected(null);
    setView("list");
  }

  function handleMinimize() {
    setChatWidgetOpen(false);
  }

  return (
    <>
      {/* Floating bubble - visible when panel is closed */}
      {!isOpen && (
        <button
          onClick={() => setChatWidgetOpen(true)}
          aria-label={`Mensajes${unreadCount > 0 ? `, ${unreadCount} sin leer` : ""}`}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        >
          <MessageSquare className="w-7 h-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel - visible when open */}
      {!isOpen ? null : (
    <div
      className={`
        fixed z-50 flex flex-col bg-white dark:bg-[#0a0e1a] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl
        sm:w-[350px] sm:h-[500px] sm:bottom-6 sm:right-6
        inset-0 sm:inset-auto
      `}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0e1a]">
        <div className="flex items-center gap-2">
          {view === "chat" && (
            <button
              onClick={handleBack}
              className="p-2 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          )}
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            {view === "chat" ? selected?.displayName ?? "Chat" : "Mensajes"}
          </h2>
        </div>
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Minimizar"
        >
          <Minimize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {view === "list" ? (
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                Cargando...
              </div>
            )}
            {!loading && conversations.length === 0 && (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400">
                <div>
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay conversaciones</p>
                  <a
                    href="/dashboard/mensajes"
                    className="text-sm text-violet-500 hover:text-violet-400 mt-2 inline-block"
                  >
                    Ir a Mensajes
                  </a>
                </div>
              </div>
            )}
            {!loading && conversations.length > 0 && (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConversation(c)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {!c.isGroup && c.otherParticipants[0]?.avatarUrl ? (
                        <img
                          src={`/api/users/${c.otherParticipants[0].id}/avatar`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : !c.isGroup ? (
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {c.displayName.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 dark:text-white truncate text-sm">
                          {c.displayName}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-medium">
                            {c.unreadCount > 9 ? "9+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {c.lastMessage
                          ? `${c.lastMessage.senderName}: ${c.lastMessage.content}`
                          : "Sin mensajes"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/30"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender.id === currentUserId ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] ${
                      msg.sender.id === currentUserId
                        ? "bg-violet-600 text-white rounded-2xl rounded-br-md"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-2xl rounded-bl-md"
                    } px-3 py-2`}
                  >
                    {selected?.isGroup && msg.sender.id !== currentUserId && (
                      <p className="text-[10px] font-medium opacity-80 mb-0.5">{msg.sender.name}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <span className="text-[10px] opacity-70 block mt-0.5">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0e1a]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  maxLength={5000}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <Button
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  size="sm"
                >
                  Enviar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
      )}
    </>
  );
}
