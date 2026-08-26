'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api, type ChatMessage } from '@/lib/api';
import { Send as SendIcon } from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatHistory().then(res => {
      if (res.success && res.data) setMessages(res.data.messages);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    setMessages(prev => [
      ...prev,
      { id: `pending-${Date.now()}`, role: 'USER', content: text, createdAt: new Date().toISOString() },
    ]);

    const response = await api.sendChatMessage(text);
    setSending(false);

    if (response.success && response.data) {
      setMessages(prev => [...prev, response.data!.message]);
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'ASSISTANT',
          content: response.error?.message || "Sorry, I couldn't reply. Try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  return (
    <Card className="flex h-[28rem] flex-col">
      <p className="mb-3 text-sm font-semibold text-text-primary">Ask your coach</p>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {loaded && messages.length === 0 && (
          <p className="text-sm text-text-tertiary">
            Ask anything about your training - "Why is my bench stuck?" or "Should I train legs
            tomorrow?"
          </p>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'USER' ? 'bg-accent text-accent-foreground' : 'bg-surface-2 text-text-primary'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-2">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask your coach..."
          className="flex-1 rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none focus:border-border-strong"
        />
        <Button size="sm" onClick={send} disabled={sending || !input.trim()}>
          <SendIcon fontSize="small" />
        </Button>
      </div>
    </Card>
  );
}
