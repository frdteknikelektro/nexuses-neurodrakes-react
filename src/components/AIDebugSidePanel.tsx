import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import type { AIDebugTurn } from '../hooks/useParleyAI';

interface AIDebugSidePanelProps {
  turns: AIDebugTurn[];
  isOpen: boolean;
  onClose: () => void;
}

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function roleTone(role: string): string {
  if (role === 'system') return 'border-sky/25 bg-sky/10 text-sky';
  if (role === 'user') return 'border-green/25 bg-green/10 text-green';
  if (role === 'assistant') return 'border-gold/25 bg-gold/10 text-gold';
  return 'border-purple/25 bg-purple/10 text-purple';
}

function statusTone(status: AIDebugTurn['status']): string {
  if (status === 'ai') return 'border-green/25 bg-green/10 text-green';
  if (status === 'fallback') return 'border-gold/25 bg-gold/10 text-gold';
  return 'border-rust/30 bg-rust/10 text-rust';
}

function DebugMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:whitespace-pre-wrap prose-code:text-brown prose-strong:text-brown text-brown/80">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

function DebugJson({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/35 p-2 text-[11px] leading-relaxed text-brown/75">
      {typeof value === 'string' ? prettyJson(value) : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AIDebugSidePanel({ turns, isOpen, onClose }: AIDebugSidePanelProps) {
  const latest = turns[turns.length - 1];
  if (!isOpen) return null;

  const drawer = (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close AI debug panel"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section
        aria-modal="true"
        role="dialog"
        className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#050914]/98 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-wood">AI debug</div>
            <h2 className="text-base font-semibold text-brown">AI event timeline</h2>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-sky">
              {turns.length} turn{turns.length === 1 ? '' : 's'} captured
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold uppercase tracking-[0.18em] text-brown transition-colors hover:border-gold/35 hover:bg-gold/10"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!latest ? (
            <div className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-brown/45">
              No AI calls yet.
            </div>
          ) : turns.map((turn, turnIndex) => (
            <details key={turn.id} className="group border border-white/10 bg-[#050914]/80" open={turnIndex === turns.length - 1}>
              <summary className="cursor-pointer list-none px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-brown">Turn {turnIndex + 1}</div>
                    <div className="truncate text-[10px] uppercase tracking-[0.16em] text-wood">
                      {turn.model} - {turn.api === 'responses' ? 'responses' : 'chat'} - {turn.status}
                    </div>
                  </div>
                  <div className={`shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${statusTone(turn.status)}`}>
                    {turn.status}
                  </div>
                </div>
              </summary>

              <div className="space-y-2 border-t border-white/10 p-3">
                {turn.error ? (
                  <div className="border border-rust/30 bg-rust/10 px-3 py-2 text-xs leading-relaxed text-rust">
                    {turn.error}
                  </div>
                ) : null}

                {turn.events?.length ? (
                  <div className="space-y-2">
                    {turn.events.map(event => (
                      <div key={event.id} className="rounded border border-white/10 bg-white/[0.03] p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="border border-sky/25 bg-sky/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-sky">
                            {event.type}
                          </span>
                          <span className="truncate text-[10px] text-brown/35">{event.at}</span>
                        </div>
                        <div className="text-xs font-semibold text-brown">{event.title}</div>
                        {event.content ? (
                          <div className="mt-2">
                            <DebugMarkdown>{event.content}</DebugMarkdown>
                          </div>
                        ) : null}
                        {typeof event.data !== 'undefined' ? (
                          <div className="mt-2">
                            <DebugJson value={event.data} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {turn.messages?.map((message, messageIndex) => (
                  <div key={`${turn.id}-${messageIndex}`} className="rounded border border-white/10 bg-white/[0.03] p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${roleTone(message.role)}`}>
                        {message.role}
                      </span>
                      {'tool_call_id' in message ? (
                        <span className="truncate text-[10px] text-brown/35">{message.tool_call_id}</span>
                      ) : null}
                    </div>

                    {message.content ? (
                      message.role === 'tool' ? (
                        <DebugJson value={message.content} />
                      ) : (
                        <DebugMarkdown>{message.content}</DebugMarkdown>
                      )
                    ) : (
                      <div className="text-xs italic text-brown/35">No text content.</div>
                    )}

                    {'tool_calls' in message && message.tool_calls?.length ? (
                      <div className="mt-2 space-y-2">
                        {message.tool_calls.map(toolCall => (
                          <details key={toolCall.id} className="border border-gold/20 bg-gold/10">
                            <summary className="cursor-pointer px-2 py-1 text-xs font-semibold text-gold">
                              Tool call: {toolCall.function.name}
                            </summary>
                            <div className="border-t border-gold/20 p-2">
                              <DebugJson value={toolCall.function.arguments} />
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );

  return createPortal(drawer, document.body);
}
