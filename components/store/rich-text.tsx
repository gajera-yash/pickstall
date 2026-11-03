import type { CSSProperties, ReactNode } from "react";

import { safeHref, type RichBlock, type RichDoc, type RichInline } from "@/lib/products/rich-text";
import { cn } from "@/lib/utils";

// Renders a product description (D-049) as React elements, node by node from the allow-list.
// There is no HTML string anywhere, so nothing a creator writes can become markup or script; links
// are checked again here and always open in a new tab without referrer or opener.

function inline(nodes: RichInline[] | undefined, linkStyle?: CSSProperties): ReactNode[] {
  return (nodes ?? []).map((node, index) => {
    if (node.type === "hardBreak") return <br key={index} />;
    let content: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") content = <strong>{content}</strong>;
      else if (mark.type === "italic") content = <em>{content}</em>;
      else if (mark.type === "underline") content = <u>{content}</u>;
      else if (mark.type === "link") {
        const href = safeHref(mark.attrs.href);
        if (href) {
          content = (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="underline underline-offset-4" style={linkStyle}>
              {content}
            </a>
          );
        }
      }
    }
    return <span key={index}>{content}</span>;
  });
}

function block(node: RichBlock, key: number, linkStyle?: CSSProperties): ReactNode {
  switch (node.type) {
    case "paragraph":
      // An empty paragraph is a blank line the creator left on purpose.
      return node.content?.length ? <p key={key}>{inline(node.content, linkStyle)}</p> : <p key={key} aria-hidden="true">&nbsp;</p>;
    case "heading":
      return node.attrs.level === 2 ? (
        <h2 key={key} className="font-display text-h3">
          {inline(node.content, linkStyle)}
        </h2>
      ) : (
        <h3 key={key} className="font-display text-h4">
          {inline(node.content, linkStyle)}
        </h3>
      );
    case "bulletList":
    case "orderedList": {
      const List = node.type === "bulletList" ? "ul" : "ol";
      return (
        <List key={key} className={cn("flex flex-col gap-1 pl-6", node.type === "bulletList" ? "list-disc" : "list-decimal")}>
          {node.content.map((item, index) => (
            <li key={index}>{item.content.map((child, childIndex) => block(child, childIndex, linkStyle))}</li>
          ))}
        </List>
      );
    }
  }
}

/** A description document. Colors come from the caller (the creator's theme on the store page). */
export function RichTextView({ doc, className, linkStyle }: { doc: RichDoc; className?: string; linkStyle?: CSSProperties }) {
  return <div className={cn("flex flex-col gap-3 break-words", className)}>{doc.content.map((node, index) => block(node, index, linkStyle))}</div>;
}
