"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { CostiMascot, type CostiState } from "./costi-mascot";
import { CostiMarkdown } from "./costi-markdown";
import { X, Send, Sparkles, RotateCcw, Maximize2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Care e TVA-ul standard in 2026?",
  "Cum fac inchidere de luna in Saga?",
  "Ce contributii platesc la un salariu de 5000 RON?",
  "Cand depun D112?",
];

export function CostiChat() {
  const router = useRouter();
  const pathname = usePathname();
  const onCostiPage = pathname === "/costi";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [costiState, setCostiState] = useState<CostiState>("greeting");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    setInput("");
    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setCostiState("thinking");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Connection failed" }));
        setCostiState("error");
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: err.error === "Ollama unavailable"
              ? "Nu ma pot conecta la Ollama. Verifica ca serverul ruleaza: `ollama serve`"
              : `Eroare: ${err.error ?? "necunoscuta"}`,
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      setCostiState("working");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
          return updated;
        });
      }

      setCostiState("success");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setCostiState("greeting");
      } else {
        setCostiState("error");
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Eroare de conexiune. Incearca din nou.",
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleReset() {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setCostiState("greeting");
    setStreaming(false);
    setInput("");
  }

  if (onCostiPage) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full p-2.5 transition-all duration-300",
          "bg-dark-2 border border-dark-3 text-gray-light shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
          "hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(13,107,94,0.2)] hover:text-white",
          "active:scale-95",
          open && "scale-0 opacity-0 pointer-events-none"
        )}
        title="Intreaba-l pe Costi"
      >
        <CostiMascot state="greeting" size={32} />
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col",
          "w-[420px] h-[640px] max-h-[calc(100vh-3rem)]",
          "rounded-2xl border border-dark-3 bg-dark-2 shadow-[0_24px_80px_rgba(0,0,0,0.6)]",
          "transition-all duration-300 origin-bottom-right",
          open ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-dark-3 px-4 py-3">
          <CostiMascot state={costiState} size={40} />
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Costica</div>
            <div className="text-[0.65rem] text-gray">Expert contabil Costify</div>
          </div>
          <button
            onClick={handleReset}
            className="rounded-lg p-1.5 text-gray transition-colors hover:bg-dark-3 hover:text-gray-light"
            title="Conversatie noua"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/costi");
            }}
            className="rounded-lg p-1.5 text-gray transition-colors hover:bg-dark-3 hover:text-gray-light"
            title="Deschide pagina completa"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-gray transition-colors hover:bg-dark-3 hover:text-gray-light"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-4 pb-2">
              <CostiMascot state="teaching" size={100} />
              <p className="mt-3 text-center text-sm text-gray">
                Salut! Sunt <span className="font-semibold text-primary-light">Costi</span>. 
                Intreaba-ma orice despre contabilitate, fiscalitate sau Saga C.
              </p>
              <div className="mt-4 flex flex-col gap-2 w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-dark-3 px-3 py-2 text-left text-xs text-gray-light",
                      "transition-all hover:border-primary/30 hover:bg-primary/[0.04] hover:text-white"
                    )}
                  >
                    <Sparkles size={12} className="shrink-0 text-primary-light opacity-60" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.8rem] leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary/20 text-white rounded-br-md"
                    : "bg-dark-3/60 text-gray-light rounded-bl-md"
                )}
              >
                {msg.role === "assistant" && msg.content === "" && streaming ? (
                  <div className="flex items-center gap-2 text-gray">
                    <CostiMascot state="thinking" size={24} />
                    <span className="animate-pulse text-xs">Analizez...</span>
                  </div>
                ) : msg.role === "assistant" ? (
                  <CostiMarkdown content={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-dark-3 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-dark-3 bg-dark px-3 py-2 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrie intrebarea ta..."
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray/60 outline-none",
                "max-h-24 scrollbar-thin"
              )}
              style={{ minHeight: "1.5rem" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 96) + "px";
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              className={cn(
                "shrink-0 rounded-lg p-1.5 transition-all",
                input.trim() && !streaming
                  ? "text-primary hover:bg-primary/10"
                  : "text-gray/30 cursor-not-allowed"
              )}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[0.6rem] text-gray/40">
            <span>Costi — expert contabil Costify</span>
            <span>·</span>
            <a href="/costi" className="text-primary-light/50 hover:text-primary-light transition-colors">
              Deschide pagina completa
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
