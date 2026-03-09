"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  ArrowLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Smile,
  Paperclip,
  Users,
  Bot,
} from "lucide-react";
import { useAtomValue } from "jotai";
import { userIdAtom, userRoleAtom } from "@/store";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { Button } from "@/components/atoms";

const COMMON_EMOJIS = [
  "😀", "😊", "😂", "❤️", "👍", "👎", "🎉", "🔥",
  "✅", "❌", "⭐", "💯", "🙏", "👋", "😢", "😡",
  "💪", "🚀", "📌", "💡", "📝", "📅", "⏰", "🔔",
];

interface ConversationItem {
  id: string;
  name: string | null;
  isGroup: boolean;
  isAgent?: boolean;
  displayName: string;
  lastMessage: { id: string; content: string; createdAt: string; senderName: string } | null;
  otherParticipants: { id: string; name: string; avatarUrl: string | null; isBot?: boolean }[];
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

interface UserItem {
  id: string;
  name: string;
  email: string;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("es", { weekday: "short" });
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function MensajesPage() {
  const currentUserId = useAtomValue(userIdAtom);
  const userRole = useAtomValue(userRoleAtom);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMsgMenu, setShowMsgMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [companyUsers, setCompanyUsers] = useState<UserItem[]>([]);
  const [newParticipantIds, setNewParticipantIds] = useState<Set<string>>(new Set());
  const [newIsGroup, setNewIsGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [agentTyping, setAgentTyping] = useState(false);
  const [agentModels, setAgentModels] = useState<{ provider: string; id: string; label: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; id: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUserScrolling = useRef(false);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
  }, []);

  const loadMessages = useCallback(
    async (cursor?: string) => {
      if (!selected) return;
      const url = cursor
        ? `/api/conversations/${selected.id}/messages?cursor=${cursor}&limit=50`
        : `/api/conversations/${selected.id}/messages?limit=50`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setMessages((prev) => [...prev, ...data.messages].reverse());
        } else {
          setMessages(data.messages.reverse());
        }
      }
    },
    [selected?.id]
  );

  useEffect(() => {
    loadConversations();
    setLoading(false);
  }, [loadConversations]);

  useEffect(() => {
    if (selected) {
      setMessages([]);
      isUserScrolling.current = false;
      loadMessages();
    }
  }, [selected?.id, loadMessages]);

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, [selected?.id, loadMessages]);

  useEffect(() => {
    if (!isUserScrolling.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      const threshold = 100;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      isUserScrolling.current = !atBottom;
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [selected?.id]);

  useEffect(() => {
    if (selected?.isAgent && agentModels.length === 0) {
      fetch("/api/agent/models")
        .then((r) => (r.ok ? r.json() : { models: [] }))
        .then((data) => setAgentModels(data.models || []));
    }
  }, [selected?.isAgent, agentModels.length]);

  useEffect(() => {
    if (showNewModal) {
      fetch("/api/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((users: UserItem[]) => setCompanyUsers(users.filter((u) => u.id !== currentUserId)));
    }
  }, [showNewModal, currentUserId]);

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

        if (selected.isAgent) {
          setAgentTyping(true);
          try {
            const agentRes = await fetch("/api/agent/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: selected.id,
                modelProvider: selectedModel?.provider,
                modelName: selectedModel?.id,
              }),
            });
            if (agentRes.ok) {
              await loadMessages();
            } else {
              const err = await agentRes.json();
              setToast({ message: err.error || "Error del agente", type: "error" });
            }
          } finally {
            setAgentTyping(false);
          }
        }
      } else {
        const err = await res.json();
        setToast({ message: err.error || "Error al enviar", type: "error" });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCreateConversation() {
    if (newParticipantIds.size === 0) {
      setToast({ message: "Selecciona al menos un usuario", type: "error" });
      return;
    }
    if (newIsGroup && !newGroupName.trim()) {
      setToast({ message: "El grupo debe tener un nombre", type: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: Array.from(newParticipantIds),
          name: newIsGroup ? newGroupName.trim() : undefined,
          isGroup: newIsGroup,
        }),
      });
      if (res.ok) {
        const conv = await res.json();
        setConversations((prev) => [conv, ...prev]);
        setSelected(conv);
        setShowNewModal(false);
        setNewParticipantIds(new Set());
        setNewGroupName("");
        setNewIsGroup(false);
        setMobileView("chat");
      } else {
        const err = await res.json();
        setToast({ message: err.error || "Error al crear", type: "error" });
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleEditMessage(msg: MessageItem) {
    if (!selected || msg.sender.id !== currentUserId) return;
    const content = editContent.trim();
    if (!content) return;
    const res = await fetch(
      `/api/conversations/${selected.id}/messages/${msg.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? updated : m))
      );
      setEditingId(null);
      setShowMsgMenu(null);
    }
  }

  async function handleDeleteMessage(msg: MessageItem) {
    if (!selected) return;
    if (msg.sender.id !== currentUserId && !confirm("¿Eliminar este mensaje?")) return;
    const res = await fetch(
      `/api/conversations/${selected.id}/messages/${msg.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setShowMsgMenu(null);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    e.target.value = "";
    setSending(true);
    try {
      const msgRes = await fetch(`/api/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: file.name }),
      });
      if (!msgRes.ok) {
        setToast({ message: "Error al crear mensaje", type: "error" });
        return;
      }
      const msg = await msgRes.json();
      const form = new FormData();
      form.append("file", file);
      form.append("messageId", msg.id);
      const attachRes = await fetch(
        `/api/conversations/${selected.id}/attachments`,
        { method: "POST", body: form }
      );
      if (attachRes.ok) {
        const att = await attachRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, attachments: [...m.attachments, att] }
              : m
          )
        );
        loadConversations();
      } else {
        const err = await attachRes.json();
        setToast({ message: err.error || "Error al subir", type: "error" });
      }
    } finally {
      setSending(false);
    }
  }

  function insertEmoji(emoji: string) {
    setInput((prev) => prev + emoji);
  }

  return (
    <div className="h-[calc(100vh-8rem)] sm:h-[calc(100vh-7rem)] flex flex-col bg-white dark:bg-[#0a0e1a] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-1 min-h-0">
        {/* Conversation list */}
        <div
          className={`${
            mobileView === "list"
              ? "flex flex-col w-full"
              : "hidden sm:flex sm:flex-col sm:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-500" />
              Mensajes
            </h1>
            <Button
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setShowNewModal(true);
                setNewParticipantIds(new Set());
                setNewGroupName("");
                setNewIsGroup(false);
              }}
            >
              Nueva
            </Button>
          </div>
          <div className="flex flex-1 flex-col min-h-0">
            {loading && (
              <div className="flex flex-1 items-center justify-center text-slate-500 dark:text-slate-400">
                Cargando...
              </div>
            )}
            {!loading && conversations.length === 0 && (
              <div className="flex flex-1 items-center justify-center min-h-0 p-8">
                <div className="text-center text-slate-500 dark:text-slate-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay conversaciones</p>
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => setShowNewModal(true)}
                  >
                    Nueva conversación
                  </Button>
                </div>
              </div>
            )}
            {!loading && conversations.length > 0 && (
              <div className="flex-1 min-h-0 overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelected(c);
                    setMobileView("chat");
                  }}
                  className={`w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    selected?.id === c.id
                      ? "bg-violet-50 dark:bg-violet-500/10 border-l-4 border-violet-500"
                      : ""
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                    c.isAgent
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}>
                    {c.isAgent ? (
                      <Bot className="w-6 h-6 text-white" />
                    ) : !c.isGroup && c.otherParticipants[0]?.avatarUrl ? (
                      <img
                        src={`/api/users/${c.otherParticipants[0].id}/avatar`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : !c.isGroup ? (
                      <span className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                        {c.displayName.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Users className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {c.displayName}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {formatTime(c.updatedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {c.lastMessage
                        ? `${c.lastMessage.senderName}: ${c.lastMessage.content}`
                        : "Sin mensajes"}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-medium">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </button>
              ))}
              </div>
            )}
          </div>
        </div>

        {/* Active conversation */}
        <div
          className={`min-w-0 ${
            mobileView === "chat"
              ? "flex flex-col flex-1"
              : "hidden sm:flex sm:flex-col sm:flex-1"
          }`}
        >
          {selected ? (
            <>
              <div className={`flex-shrink-0 flex items-center gap-3 p-4 border-b bg-white dark:bg-[#0a0e1a] ${
                selected.isAgent
                  ? "border-violet-200/50 dark:border-violet-500/20"
                  : "border-slate-200 dark:border-slate-800"
              }`}>
                <button
                  onClick={() => setMobileView("list")}
                  className="sm:hidden p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  aria-label="Volver"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  selected.isAgent
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}>
                  {selected.isAgent ? (
                    <Bot className="w-5 h-5 text-white" />
                  ) : !selected.isGroup && selected.otherParticipants[0]?.avatarUrl ? (
                    <img
                      src={`/api/users/${selected.otherParticipants[0].id}/avatar`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : selected.isGroup ? (
                    <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  ) : (
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {selected.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                    {selected.displayName}
                    {selected.isAgent && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_0_8px_rgba(139,92,246,0.4)]">
                        AI
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selected.isAgent ? "Asistente de IA" : (
                      <>
                        {selected.otherParticipants.length} participante
                        {selected.otherParticipants.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </p>
                </div>
                {selected.isAgent && agentModels.length > 0 && (
                  <select
                    value={selectedModel ? `${selectedModel.provider}:${selectedModel.id}` : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) { setSelectedModel(null); return; }
                      const [provider, ...rest] = val.split(":");
                      setSelectedModel({ provider, id: rest.join(":") });
                    }}
                    className="flex-shrink-0 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1.5 min-h-[2.75rem] focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    <option value="">Modelo predeterminado</option>
                    {agentModels.map((m) => (
                      <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto p-4 space-y-3 ${
                  selected.isAgent
                    ? "bg-gradient-to-b from-slate-50 via-violet-50/30 to-slate-50 dark:from-[#0b0f1e] dark:via-[#0f0a20] dark:to-[#0b0f1e]"
                    : "bg-slate-50 dark:bg-slate-900/30"
                }`}
              >
                {messages.map((msg) => {
                  const isOwn = msg.sender.id === currentUserId;
                  const isAgentMsg = selected.isAgent && !isOwn;
                  return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    {isAgentMsg && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mr-2 mt-1 shadow-[0_0_10px_rgba(139,92,246,0.4)]">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`relative max-w-[85%] sm:max-w-[75%] group ${
                        isOwn
                          ? "bg-violet-600 text-white rounded-2xl rounded-br-md"
                          : isAgentMsg
                            ? "bg-white/80 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md border border-violet-200/50 dark:border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.08)] dark:shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-2xl rounded-bl-md"
                      } px-4 py-2`}
                    >
                      {selected.isGroup && msg.sender.id !== currentUserId && (
                        <p className="text-xs font-medium opacity-80 mb-0.5">
                          {msg.sender.name}
                        </p>
                      )}
                      {editingId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full min-h-[60px] px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMessage(msg)}
                              className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditContent("");
                              }}
                              className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          {msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {msg.attachments.map((a) => (
                                <a
                                  key={a.id}
                                  href={a.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs underline opacity-90 truncate"
                                >
                                  📎 {a.fileName}
                                </a>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-2 mt-1">
                            {msg.editedAt && (
                              <span className="text-[10px] opacity-70">
                                (editado)
                              </span>
                            )}
                            <span className="text-[10px] opacity-70">
                              {formatTime(msg.createdAt)}
                            </span>
                            {(msg.sender.id === currentUserId ||
                              userRole === "ADMIN" ||
                              userRole === "SUPER_ADMIN") && (
                              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() =>
                                    setShowMsgMenu(
                                      showMsgMenu === msg.id ? null : msg.id
                                    )
                                  }
                                  className="p-0.5 hover:bg-white/20 rounded"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                                {showMsgMenu === msg.id && (
                                  <div className="absolute right-0 top-full mt-1 py-1 bg-slate-800 dark:bg-slate-900 rounded-lg shadow-xl border border-slate-700 z-10 min-w-[120px]">
                                    {msg.sender.id === currentUserId && (
                                      <button
                                        onClick={() => {
                                          setEditingId(msg.id);
                                          setEditContent(msg.content);
                                          setShowMsgMenu(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Editar
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteMessage(msg)}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
                {agentTyping && selected?.isAgent && (
                  <div className="flex justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mr-2 mt-1 shadow-[0_0_10px_rgba(139,92,246,0.4)]">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white/80 dark:bg-slate-800/90 border border-violet-200/50 dark:border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.08)] dark:shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce shadow-[0_0_6px_rgba(139,92,246,0.6)]" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-bounce shadow-[0_0_6px_rgba(217,70,239,0.6)]" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce shadow-[0_0_6px_rgba(139,92,246,0.6)]" style={{ animationDelay: "300ms" }} />
                        <span className="ml-2 text-xs text-violet-500 dark:text-violet-400">Aria está pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0e1a]">
                <div className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className="p-2 text-slate-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-50"
                      aria-label="Adjuntar archivo"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="relative flex-1 min-w-0">
                    {showEmoji && (
                      <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => insertEmoji(emoji)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowEmoji(!showEmoji)}
                        className="p-2 text-slate-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg transition-colors"
                        aria-label="Emoji"
                      >
                        <Smile className="w-5 h-5" />
                      </button>
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
                        className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                  </div>
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
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400 p-8">
              <div className="text-center max-w-xs mx-auto">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-10 h-10 opacity-40" />
                </div>
                <p className="text-lg font-medium">Selecciona una conversación</p>
                <p className="text-sm mt-1 opacity-70">o crea una nueva para empezar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nueva conversación"
        size="md"
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsGroup}
              onChange={(e) => setNewIsGroup(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-violet-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Crear grupo
            </span>
          </label>
          {newIsGroup && (
            <div>
              <label
                htmlFor="new-group-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Nombre del grupo *
              </label>
              <input
                id="new-group-name"
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ej: Equipo de ventas"
                className="input-field w-full"
              />
            </div>
          )}
          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Seleccionar usuarios
            </span>
            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1">
              {companyUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={newParticipantIds.has(u.id)}
                    onChange={() => {
                      setNewParticipantIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(u.id)) next.delete(u.id);
                        else next.add(u.id);
                        return next;
                      });
                    }}
                    className="rounded border-slate-300 dark:border-slate-600 text-violet-600"
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {u.name}
                  </span>
                  <span className="text-xs text-slate-500 truncate">{u.email}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateConversation}
              loading={creating}
              disabled={
                newParticipantIds.size === 0 ||
                (newIsGroup && !newGroupName.trim())
              }
            >
              Crear
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
