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
  const [showDocs, setShowDocs] = useState(false);
  const [health, setHealth] = useState<{ ollama: boolean; totalChunks: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadDocs();
    checkHealth();
  }, []);

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
      const conversationHistory = messages.slice(-6).map(
        (m) => `${m.role === "user" ? "Хэрэглэгч" : "AI"}: ${m.content}`
      );

      // Use streaming
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
        }
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
          const lines = text.split("\n");

          for (const line of lines) {
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
              if (data.done && data.sources) {
                sources = data.sources;
              }
              if (data.error) {
                fullContent += `\n\n⚠️ ${data.error}`;
              }
            } catch {}
          }
        }
      }

      // Update final message with sources
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: fullContent,
          sources,
        };
        return updated;
      });
    } catch (err) {
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
        `Боловсруулсан: ${res.data.processed?.length || 0}\nАлдаа: ${res.data.errors?.length || 0}`
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
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      <ToolPageHeader
        icon={
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
        }
        title="RAG Чат"
        subtitle={
          health
            ? `${health.ollama ? "🟢" : "🔴"} Ollama · ${health.totalChunks} chunk`
            : undefined
        }
        rightContent={
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
          >
            {showDocs ? "Чат руу буцах" : `Баримтууд (${docs.length})`}
          </button>
        }
      />

      {showDocs ? (
        /* Document Management Panel */
        <div className="flex-1 max-w-3xl mx-auto w-full p-6 space-y-4">
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Файл байршуулах
            </button>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderSync className="w-4 h-4" />
              )}
              Training дата скан
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Баримт байхгүй байна</p>
              <p className="text-xs mt-1">PDF, DOCX, TXT, MD файл байршуулна уу</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.source}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 rounded-xl border border-slate-700/40"
                >
                  <File className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{doc.source}</p>
                    <p className="text-xs text-slate-500">{doc.chunksCount} chunks</p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.source)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Chat Panel */
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Bot className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">RAG Чат</p>
                <p className="text-sm mt-1">
                  Байршуулсан баримтуудаас мэдээлэл хайж хариулна
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800/60 border border-slate-700/40"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-700/40">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                        Эх сурвалж
                      </p>
                      {msg.sources.map((s, j) => (
                        <div key={j} className="text-xs text-slate-400 mt-1">
                          📄 {s.source}{" "}
                          <span className="text-slate-600">({s.score})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-800/60">
            {!health?.ollama && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Ollama холбогдоогүй байна. Серверээ шалгана уу.
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Асуултаа бичнэ үү..."
                className="flex-1 px-4 py-3 bg-slate-800/60 border border-slate-700/40 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
