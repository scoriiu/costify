"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { CostiMascot, type CostiState } from "./costi-mascot";
import { CostiMarkdown } from "./costi-markdown";
import { Send, Sparkles, RotateCcw, ArrowDown } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Care e TVA-ul standard in 2026?",
  "Cum fac inchidere de luna in Saga?",
  "Ce contributii platesc la un salariu de 5000 RON?",
  "Cand depun D112?",
  "Cum inregistrez o factura de intrare in Saga?",
  "Care sunt cotele de impozit pe dividende?",
  "Cum configurez o societate noua in Saga C?",
  "Ce e taxarea inversa si cand se aplica?",
];

const STORAGE_KEY = "costify-costi-chat";
const API_CONTEXT_LIMIT = 8;

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch { /* quota exceeded — ignore */ }
}

export function CostiFullChat() {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [costiState, setCostiState] = useState<CostiState>(() => loadMessages().length > 0 ? "success" : "greeting");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distFromBottom > 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        body: JSON.stringify({ messages: newMessages.slice(-API_CONTEXT_LIMIT) }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Connection failed" }));
        setCostiState("error");
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Eroare: ${err.error ?? "necunoscuta"}`,
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
      setMessages((prev) => { saveMessages(prev); return prev; });
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
    sessionStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-12 pb-6">
              <CostiMascot state="teaching" size={160} />
              <h2 className="mt-5 text-xl font-bold text-white">Salut! Sunt Costi.</h2>
              <p className="mt-2 text-center text-sm text-gray max-w-md">
                Expert contabil Costify. Intreaba-ma orice despre contabilitate romaneasca, 
                fiscalitate, salarizare, Saga C, sau legislatie.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border border-dark-3 px-4 py-3 text-left text-xs text-gray-light leading-relaxed",
                      "transition-all hover:border-primary/30 hover:bg-primary/[0.04] hover:text-white"
                    )}
                  >
                    <Sparkles size={13} className="mt-0.5 shrink-0 text-primary-light opacity-60" />
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
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 mt-1">
                  <CostiMascot
                    state={i === messages.length - 1 ? costiState : "success"}
                    size={72}
                  />
                </div>
              )}
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "max-w-[65%] bg-primary/20 text-white rounded-br-md"
                    : "max-w-full flex-1 bg-dark-3/40 text-gray-light rounded-bl-md"
                )}
              >
                {msg.role === "assistant" && msg.content === "" && streaming ? (
                  <div className="flex items-center gap-2 text-gray">
                    <span className="animate-pulse">Analizez...</span>
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
        {showScrollDown && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-dark-3 bg-dark-2/90 px-3 py-1.5 text-[12px] font-semibold text-gray-light shadow-lg backdrop-blur-sm transition-all hover:bg-dark-3 hover:text-white cursor-pointer"
              style={{ letterSpacing: "-0.04em" }}
            >
              <ArrowDown size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-dark-3 bg-dark-2/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-end gap-3 rounded-2xl border border-dark-3 bg-dark px-4 py-3 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrie intrebarea ta..."
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray/60 outline-none",
                "max-h-32"
              )}
              style={{ minHeight: "1.5rem" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              className={cn(
                "shrink-0 rounded-xl p-2.5 transition-all",
                input.trim() && !streaming
                  ? "bg-primary text-[#E9E8E3] hover:bg-primary-dark shadow-[0_4px_16px_rgba(13,107,94,0.3)]"
                  : "text-gray/30 cursor-not-allowed"
              )}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
