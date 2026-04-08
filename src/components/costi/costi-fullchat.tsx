"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { CostiMascot, type CostiState } from "./costi-mascot";
import { CostiMarkdown } from "./costi-markdown";
import { Send, Sparkles, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

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

export function CostiFullChat() {
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

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-dark-3 bg-dark-2/80 backdrop-blur-xl px-6 py-4">
        <Link
          href="/clients"
          className="rounded-lg p-2 text-gray transition-colors hover:bg-dark-3 hover:text-white"
        >
          <ArrowLeft size={18} />
        </Link>
        <CostiMascot state={costiState} size={72} />
        <div className="flex-1">
          <div className="text-base font-bold text-white">Costica</div>
          <div className="text-xs text-gray">Expert contabil Costify — intreaba orice despre contabilitate, fiscalitate sau Saga C</div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-lg border border-dark-3 px-3 py-1.5 text-xs text-gray transition-colors hover:border-primary/30 hover:text-white"
        >
          <RotateCcw size={13} />
          Conversatie noua
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
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
                    size={32}
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
                  ? "bg-primary text-white hover:bg-primary-dark shadow-[0_4px_16px_rgba(108,92,231,0.3)]"
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
