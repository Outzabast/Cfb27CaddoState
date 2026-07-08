import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Element styling for rendered markdown, matched to the app's ESPN-ish look.
// No @tailwindcss/typography dependency — explicit classes keep it self-contained.
const components: Components = {
  h1: ({ children }) => <h2 className="mb-2 mt-6 font-heading text-2xl font-bold">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-2 mt-6 font-heading text-xl font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-4 text-lg font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-3 font-semibold">{children}</h4>,
  p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-2 border-border pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-md bg-muted p-3 text-sm">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
};

/** Renders a markdown string as styled React elements (GFM: tables, lists, links,
 *  strikethrough, …). Safe — no raw HTML is injected. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[0.95rem] leading-relaxed text-foreground/90 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
