"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders markdown with Obsidian [[wikilink]] support.
// Wikilinks become clickable spans that trigger onNavigate(noteName).

function preprocessWikilinks(text: string): string {
  // [[Target]] or [[Target|Alias]] -> [Alias](wikilink://Target)
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
    const t = target.trim();
    const a = (alias ?? t).trim();
    return `[${a}](wikilink://${encodeURIComponent(t)})`;
  });
}

// Strip YAML frontmatter so it renders as a subtle meta line instead of raw text.
function stripFrontmatter(text: string): { body: string; meta: string[] } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { body: text, meta: [] };
  const meta: string[] = [];
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/);
    if (kv) meta.push(kv[1]);
  }
  return { body: text.slice(m[0].length), meta };
}

export default function Markdown({
  text,
  onNavigate,
  className = "",
}: {
  text: string;
  onNavigate?: (note: string) => void;
  className?: string;
}) {
  const { body, meta } = stripFrontmatter(text);
  const processed = preprocessWikilinks(body);

  return (
    <div className={`md ${className}`}>
      {meta.length > 0 && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-linesub">
          {meta.map((k) => (
            <span key={k} className="tag mono">#{k}</span>
          ))}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("wikilink://")) {
              const target = decodeURIComponent(href.slice("wikilink://".length));
              return (
                <span
                  className="wikilink"
                  onClick={() => onNavigate?.(target)}
                  title={`Open ${target}`}
                >
                  {children}
                </span>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
