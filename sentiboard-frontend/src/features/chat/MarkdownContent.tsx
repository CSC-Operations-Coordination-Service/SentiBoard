"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import s from "./markdown-content.module.css";

// Converts mdast `html` nodes to `text` nodes so that rejected markers (which
// look like HTML to remark) remain visible as literal text instead of being
// silently dropped by the mdast → hast transform.
function remarkHtmlToText() {
  return (tree: { type: string; children?: unknown[] }) => {
    function walk(node: { type: string; children?: unknown[] }): void {
      if (node.type === "html") {
        node.type = "text";
        return;
      }
      if (Array.isArray(node.children)) {
        (node.children as typeof node[]).forEach(walk);
      }
    }
    walk(tree);
  };
}

interface Props {
  text: string;
}

export default function MarkdownContent({ text }: Props) {
  return (
    <div className={s.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkHtmlToText]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: () => null,
          a: (props) => {
            const href =
              typeof props.href === "string" && /^https?:\/\//.test(props.href)
                ? props.href
                : undefined;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {props.children}
              </a>
            );
          },
          table: (props) => (
            <div className={s.tableWrap}>
              <table>{props.children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
