"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang = "typescript" }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang,
      themes: {
        light: "vitesse-light",
        dark: "vitesse-dark",
      },
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    // Fallback while shiki loads
    return (
      <pre className="p-5 text-[13px] font-mono leading-relaxed overflow-x-auto text-foreground/70">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="[&_pre]:p-5 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:bg-transparent! [&_code]:bg-transparent! shiki-dual"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
