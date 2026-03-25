"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Sparkles, Loader2, Trash2, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  error?: boolean;
}

export function ChatInterface({
  organizationId,
  orgSlug,
  roomTerm,
}: {
  organizationId: string;
  orgSlug: string;
  roomTerm: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const sendMessages = useCallback(
    async (messagesToSend: Message[]) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesToSend.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            organizationId,
            orgSlug,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Something went wrong");
          setLoading(false);
          return;
        }

        const data = await response.json();
        setMessages([
          ...messagesToSend,
          { role: "assistant", content: data.content, timestamp: new Date() },
        ]);
      } catch {
        setError("Failed to connect to AI service");
      }

      setLoading(false);
      inputRef.current?.focus();
    },
    [organizationId, orgSlug]
  );

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    await sendMessages(newMessages);
  }

  function handleRetry() {
    if (loading || messages.length === 0) return;
    // Resend the current conversation to get a new assistant response
    const lastAssistantIdx = messages.findLastIndex((m) => m.role === "assistant");
    const messagesToRetry =
      lastAssistantIdx >= 0 ? messages.slice(0, lastAssistantIdx) : messages;
    if (messagesToRetry.length === 0) return;
    setMessages(messagesToRetry);
    setError("");
    sendMessages(messagesToRetry);
  }

  function handleClear() {
    setMessages([]);
    setError("");
    setInput("");
    inputRef.current?.focus();
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const suggestions = [
    `Book me a ${roomTerm.toLowerCase()} for tomorrow at 2pm`,
    "What rooms are available this Friday afternoon?",
    "Show me my upcoming events",
    `Find a ${roomTerm.toLowerCase()} for a 2-hour meeting next week`,
  ];

  return (
    <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-0">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              How can I help you today?
            </h2>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              I can book rooms, check availability, view your schedule, and
              manage events — just ask in plain English.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className="flex flex-col">
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "bg-slate-50 text-slate-700 rounded-bl-md"
                }`}
              >
                <MessageContent content={msg.content} />
              </div>
              <span
                className={`text-[10px] text-slate-400 mt-1 ${
                  msg.role === "user" ? "text-right" : "text-left"
                }`}
              >
                {formatTime(msg.timestamp)}
              </span>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-slate-50 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center gap-2">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 max-w-md">
              {error}
            </div>
            <button
              onClick={handleRetry}
              className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              title="Retry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Try "Book a ${roomTerm.toLowerCase()} for tomorrow at 10am"...`}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors disabled:opacity-50 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function InlineText({ text }: { text: string }) {
  // Parse **bold** into React elements safely (no innerHTML)
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;

        // List items
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0">•</span>
              <span>
                <InlineText text={line.replace(/^[\s]*[-•]\s*/, "")} />
              </span>
            </div>
          );
        }

        // Numbered items
        const numMatch = line.match(/^(\d+)\.\s/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 font-medium">{numMatch[1]}.</span>
              <span>
                <InlineText text={line.replace(/^\d+\.\s*/, "")} />
              </span>
            </div>
          );
        }

        return (
          <p key={i}>
            <InlineText text={line} />
          </p>
        );
      })}
    </div>
  );
}
