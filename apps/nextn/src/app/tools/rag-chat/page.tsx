"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import {
  MessageSquare,
  Send,
  Upload,
  File,
  Trash2,
  Loader2,
  Bot,
  User,
  FolderSync,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  FileText,
  Zap,
  ZapOff,
} from "lucide-react";
import api from "@/lib/api";

interface Source {
  content: string;
  source: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface DocInfo {
  source: string;
  chunksCount: number;
}

export default function RagChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [health, setHealth] = useState<{
    ollama: boolean;
    totalChunks: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadDocs();
    checkHealth();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  async function checkHealth() {
    try {
      const res = await api.get("/rag-chat/health");
      setHealth(res.data);
    } catch {
      setHealth({ ollama: false, totalChunks: 0 });
    }
  }

  async function loadDocs() {
    try {
      const res = await api.get("/rag-chat/documents");
      setDocs(res.data);
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const conversationHistory = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "Хэрэглэгч" : "AI"}: ${m.content}`);

      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("token="))
        ?.split("=")[1];

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/rag-chat/chat/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question, conversationHistory }),
        },
      );

      if (!res.ok) throw new Error("Хариулт авахад алдаа гарлаа");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let sources: Source[] = [];

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                fullContent += data.token;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: fullContent,
                  };
                  return updated;
                });
              }
              if (data.done && data.sources) sources = data.sources;
              if (data.error) fullContent += `\n\n⚠️ ${data.error}`;
            } catch {}
          }
        }
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: fullContent,
          sources,
        };
        return updated;
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Алдаа гарлаа. Дахин оролдоно уу." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/rag-chat/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadDocs();
      await checkHealth();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Файл илгээхэд алдаа гарлаа");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(source: string) {
    if (!confirm(`"${source}" устгах уу?`)) return;
    try {
      await api.delete(`/rag-chat/documents/${encodeURIComponent(source)}`);
      await loadDocs();
      await checkHealth();
    } catch {}
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await api.post("/rag-chat/documents/scan-training");
      alert(
        `Боловсруулсан: ${res.data.processed?.length || 0}\nАлдаа: ${res.data.errors?.length || 0}`,
      );
      await loadDocs();
      await checkHealth();
    } catch {
      alert("Скан хийхэд алдаа гарлаа");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0f1117] text-white">
      <style>{`
        @keyframes botFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes botShadow {
          0%, 100% { transform: scaleX(1); opacity: 0.25; }
          50% { transform: scaleX(0.65); opacity: 0.1; }
        }
        @keyframes eyeBlink {
          0%, 88%, 100% { transform: scaleY(1); }
          92% { transform: scaleY(0.08); }
        }
        @keyframes ledAnim {
          from { opacity: 0.2; }
          to { opacity: 1; }
        }
        @keyframes glowRing {
          0%, 100% { opacity: 0.2; transform: scale(1.8); }
          50% { opacity: 0.5; transform: scale(2.1); }
        }
      `}</style>
      {/* Header */}
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="RAG Чат"
        subtitle={
          health
            ? `${health.ollama ? "Ollama холбоотой" : "Ollama холбогдоогүй"} · ${health.totalChunks} chunk`
            : undefined
        }
      />

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`flex flex-col border-r border-slate-800 bg-slate-900/50 transition-all duration-300 shrink-0 ${
            sidebarOpen ? "w-72" : "w-0 overflow-hidden"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-medium text-slate-300">
              Баримтууд
            </span>
            <div className="flex items-center gap-2">
              {health && (
                <span
                  title={
                    health.ollama ? "Ollama холбоотой" : "Ollama холбогдоогүй"
                  }
                  className={`w-2 h-2 rounded-full ${health.ollama ? "bg-green-400" : "bg-red-400"}`}
                />
              )}
              <span className="text-xs text-slate-500">
                {health?.totalChunks ?? 0} chunk
              </span>
            </div>
          </div>

          {/* Upload actions */}
          <div className="p-3 space-y-2 border-b border-slate-800">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Файл байршуулах
            </button>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {scanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderSync className="w-3.5 h-3.5" />
              )}
              Training скан
            </button>
          </div>

          {/* Doc list */}
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
            {docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 py-8">
                <FileText className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs text-center">
                  Баримт байхгүй
                  <br />
                  PDF, DOCX, TXT, MD
                </p>
              </div>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.source}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 group"
                >
                  <File className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">
                      {doc.source}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {doc.chunksCount} chunks
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.source)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center justify-center w-5 bg-slate-900/30 hover:bg-slate-800 border-r border-slate-800 transition-colors shrink-0"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-3 h-3 text-slate-600" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-600" />
          )}
        </button>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Ollama warning */}
          {health && !health.ollama && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
              <ZapOff className="w-3.5 h-3.5 shrink-0" />
              Ollama сервер холбогдоогүй байна. RAG chat ажиллахгүй.
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 select-none">
                {/* 3D Bot Character */}
                <div
                  className="relative mb-6"
                  style={{ animation: "botFloat 3s ease-in-out infinite" }}
                >
                  {/* Glow ring */}
                  <div
                    className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 68%)",
                      animation: "glowRing 2.5s ease-in-out infinite",
                    }}
                  />
                  <div className="relative flex flex-col items-center">
                    {/* Antenna */}
                    <div className="flex flex-col items-center mb-0.5">
                      <div
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: "50%",
                          background: "#a78bfa",
                          boxShadow: "0 0 10px #a78bfa, 0 0 22px #7c3aed",
                        }}
                      />
                      <div
                        className="w-px h-4"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(167,139,250,0.8), rgba(109,40,217,0.2))",
                        }}
                      />
                    </div>
                    {/* Head */}
                    <div
                      className="w-24 h-24 rounded-2xl relative overflow-hidden flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(145deg, #5b21b6 0%, #4338ca 45%, #6d28d9 100%)",
                        boxShadow:
                          "0 14px 44px rgba(109,40,217,0.55), 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -3px 8px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Shine */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)",
                        }}
                      />
                      {/* Face panel */}
                      <div
                        className="w-16 h-14 rounded-xl flex flex-col items-center justify-center gap-2 relative"
                        style={{
                          background: "rgba(0,0,0,0.38)",
                          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.65)",
                        }}
                      >
                        {/* Eyes */}
                        <div className="flex gap-4 items-center">
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: "#c4b5fd",
                              boxShadow: "0 0 8px #a78bfa, 0 0 18px #7c3aed",
                              animation: "eyeBlink 5s ease-in-out infinite",
                            }}
                          />
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: "#c4b5fd",
                              boxShadow: "0 0 8px #a78bfa, 0 0 18px #7c3aed",
                              animation:
                                "eyeBlink 5s ease-in-out infinite 0.18s",
                            }}
                          />
                        </div>
                        {/* LED mouth */}
                        <div className="flex gap-0.5 items-center">
                          {[1, 0.25, 1, 0.25, 1].map((op, i) => (
                            <div
                              key={i}
                              style={{
                                width: 6,
                                height: 4,
                                borderRadius: 1,
                                background: "#818cf8",
                                opacity: op,
                                animation: `ledAnim 0.55s ease-in-out infinite ${i * 0.11}s alternate`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Floor shadow */}
                    <div
                      className="w-16 h-2 rounded-full mt-1.5 blur-sm"
                      style={{
                        background: "rgba(109,40,217,0.35)",
                        animation: "botShadow 3s ease-in-out infinite",
                      }}
                    />
                  </div>
                </div>
                <p className="text-base font-medium text-slate-500">RAG Чат</p>
                <p className="text-sm mt-1 text-slate-600 text-center max-w-xs">
                  Байршуулсан баримтуудаас мэдээлэл хайж хариулна
                </p>
                {docs.length === 0 && (
                  <p className="text-xs mt-3 text-slate-700 text-center">
                    Зүүн талд PDF, DOCX, TXT файл байршуулна уу
                  </p>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "user"
                      ? "bg-slate-700"
                      : "bg-purple-600/20 border border-purple-500/20"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  )}
                </div>

                <div
                  className={`flex flex-col gap-1 max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white rounded-tr-sm"
                        : "bg-slate-800/70 border border-slate-700/50 text-slate-200 rounded-tl-sm"
                    }`}
                  >
                    {msg.content ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <span className="flex gap-1 items-center text-slate-500">
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                    )}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {msg.sources.map((s, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800/50 border border-slate-700/40 rounded-md px-2 py-0.5"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          {s.source}
                          <span className="text-slate-700">
                            ·{(s.score * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 p-4 border-t border-slate-800/80">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Асуултаа бичнэ үү… (Shift+Enter: мөр хайрцаглах)"
                rows={1}
                className="flex-1 resize-none px-4 py-3 bg-slate-800/70 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 transition-colors leading-relaxed"
                disabled={loading}
                style={{ maxHeight: "160px" }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="shrink-0 w-10 h-10 flex items-center justify-center bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40 transition-colors mb-0.5"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-700 mt-1.5 text-center">
              Enter — илгээх · Shift+Enter — мөр хайрцаглах
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
