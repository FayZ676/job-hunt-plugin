import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const ELEMENTS: Components = {
  h1: ({ children }) => <h2 className="mt-4 mb-1 font-semibold first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-4 mb-1 font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-1 font-medium first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-4 mb-1 font-medium first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-0.5 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) =>
    <ol className="mt-2 list-decimal space-y-0.5 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer"
       className="underline decoration-base-300 underline-offset-2 hover:decoration-current">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) =>
    <blockquote className="mt-2 border-l-2 border-base-300 pl-3 text-soft">{children}</blockquote>,
  hr: () => <hr className="my-4 border-base-300" />,
  code: ({ children }) =>
    <code className="rounded bg-base-200 px-1 py-0.5 font-mono text-xs">{children}</code>,
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-box bg-base-200 p-3 font-mono text-xs">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) =>
    <th className="border-b border-base-300 py-1 pr-4 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-base-300 py-1 pr-4 align-top">{children}</td>,
};

export default function Markdown({ children, className = "" }:
  { children: string; className?: string }) {
  return (
    <div className={`max-w-[72ch] break-words text-sm leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={ELEMENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
