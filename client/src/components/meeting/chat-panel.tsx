import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  localParticipantId: string;
  localParticipantName: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-blue-600",
    "from-green-500 to-green-600",
    "from-purple-500 to-purple-600",
    "from-orange-500 to-orange-600",
    "from-pink-500 to-pink-600",
    "from-teal-500 to-teal-600",
    "from-indigo-500 to-indigo-600",
    "from-rose-500 to-rose-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({
  message,
  isLocal,
  showAvatar,
}: {
  message: ChatMessage;
  isLocal: boolean;
  showAvatar: boolean;
}) {
  const initials = getInitials(message.senderName);
  const avatarColor = getAvatarColor(message.senderName);

  return (
    <div
      className={cn(
        "flex gap-2 px-3",
        isLocal ? "flex-row-reverse" : "flex-row"
      )}
    >
      {showAvatar ? (
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 bg-gradient-to-br",
            avatarColor
          )}
        >
          {initials}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div
        className={cn(
          "max-w-[75%] flex flex-col",
          isLocal ? "items-end" : "items-start"
        )}
      >
        {showAvatar && (
          <span className="text-xs text-muted-foreground mb-1 px-1">
            {isLocal ? "You" : message.senderName}
          </span>
        )}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm",
            isLocal
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-muted rounded-tl-md"
          )}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  localParticipantId,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (content) {
      onSendMessage(content);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = messages.reduce<
    { message: ChatMessage; showAvatar: boolean }[]
  >((acc, message, index) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar =
      !prevMessage ||
      prevMessage.senderId !== message.senderId ||
      message.timestamp - prevMessage.timestamp > 60000;

    acc.push({ message, showAvatar });
    return acc;
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed right-0 top-0 h-[calc(100%-5rem)] w-80 max-w-[85vw] z-40",
          "bg-background/95 backdrop-blur-xl border-l shadow-2xl",
          "flex flex-col animate-in slide-in-from-right duration-300"
        )}
      >
        <div className="p-4 border-b bg-gradient-to-r from-background to-muted/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold text-lg">In-Meeting Chat</h2>
                <p className="text-xs text-muted-foreground">
                  {messages.length} {messages.length === 1 ? "message" : "messages"}
                </p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="py-4 space-y-3">
            {groupedMessages.length > 0 ? (
              groupedMessages.map(({ message, showAvatar }) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLocal={message.senderId === localParticipantId}
                  showAvatar={showAvatar}
                />
              ))
            ) : (
              <div className="text-center py-12 px-4">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  No messages yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Send a message to start the conversation
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-muted/20">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 h-10 bg-background border-muted-foreground/20"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="h-10 w-10 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
