import { useState, useRef, useEffect } from "react";
import { X, Send, Satellite } from "lucide-react";


interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your Copernicus Operations Dashboard assistant. Ask me anything about satellite data, availability, events, or processors.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Simulate API response (replace with real API call when backend is ready)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I understand you asked about: "${inputValue}"\n\nThis is a mockup interface. In production, I would fetch data from the chatbot API and render any tables, charts, or other widgets based on the response markers.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "200px",
        right: "20px",
        zIndex: 9999,
        fontFamily: "inherit",
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "#006b7c",
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          padding: 0,
          fontSize: "24px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 6px 16px rgba(0, 0, 0, 0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 12px rgba(0, 0, 0, 0.15)";
        }}
        aria-label="Open chatbot"
        title="Ask the chatbot"
      >
        <Satellite size={28} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "90px",
            right: 0,
            width: "380px",
            height: "500px",
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 5px 40px rgba(0, 0, 0, 0.16)",
            display: "flex",
            flexDirection: "column",
            animation: "slideUp 0.3s ease-out",
            overflow: "hidden",
            color: "#333",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem",
              background: "#006b7c",
              color: "white",
              borderBottom: "1px solid #dee2e6",
            }}
          >
            <h5 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
              Chatbot Assistant
            </h5>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: 0,
                fontSize: "1.5rem",
                lineHeight: 1,
                opacity: 0.7,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.opacity = "0.7")
              }
              aria-label="Close chatbot"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              backgroundColor: "#f8f9fa",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  animation: "slideIn 0.3s ease-out",
                }}
              >
                <div
                  style={{
                    maxWidth: msg.role === "user" ? "80%" : "90%",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    backgroundColor:
                      msg.role === "user" ? "#006b7c" : "white",
                    color: msg.role === "user" ? "white" : "#333",
                    border:
                      msg.role === "user"
                        ? "none"
                        : "1px solid #dee2e6",
                    fontSize: "0.9rem",
                    lineHeight: 1.4,
                    wordWrap: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "white",
                    border: "1px solid #dee2e6",
                    borderRadius: "0.5rem",
                    color: "#666",
                    fontSize: "0.9rem",
                  }}
                >
                  Assistant is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "0.75rem",
              borderTop: "1px solid #dee2e6",
              backgroundColor: "white",
            }}
          >
            <form
              onSubmit={handleSendMessage}
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: 0,
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.9rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #dee2e6",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                  backgroundColor: "#006b7c",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderTop: "1px solid #dee2e6",
              backgroundColor: "#f8f9fa",
              fontSize: "0.8rem",
              textAlign: "center",
              color: "#999",
            }}
          >
            Mockup Mode
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
