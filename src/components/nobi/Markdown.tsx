import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];
    const inline = !className && !text.includes("\n");
    if (inline) return <code>{text}</code>;
    return <CodeBlock code={text} language={lang} />;
  },
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ""} className="nobi-img my-2 max-h-72 rounded-[var(--radius-md)]" />
  ),
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="nobi-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
