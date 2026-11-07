import { useEffect, useState } from "react";
import { useLang } from "../i18n";

const PRIVACY_DOCUMENT_PATH = "/legal/datenschutz.md";

interface Block {
  kind: "meta" | "heading" | "paragraph";
  text: string;
}

function parseDocument(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block, index): Block[] => {
      if (index === 0) return [{ kind: "meta", text: block }];
      const lines = block.split("\n");
      if (/^\d+\.\s+[A-ZÄÖÜ0-9]/.test(lines[0])) {
        const body = lines.slice(1).join("\n").trim();
        return body
          ? [{ kind: "heading", text: lines[0] }, { kind: "paragraph", text: body }]
          : [{ kind: "heading", text: lines[0] }];
      }
      return [{ kind: "paragraph", text: block }];
    });
}

function linkify(text: string) {
  const pattern = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g;
  return text.split(pattern).map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part)) {
      return (
        <a key={index} href={`mailto:${part}`}>
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function Privacy() {
  const { t } = useLang();
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(PRIVACY_DOCUMENT_PATH)
      .then((response) => {
        if (!response.ok) throw new Error("privacy document unavailable");
        return response.text();
      })
      .then((text) => {
        if (active) setDocumentText(text);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const blocks = documentText ? parseDocument(documentText) : [];
  const metaLines = blocks[0]?.kind === "meta" ? blocks[0].text.split("\n") : [];

  return (
    <section className="card legal-page" aria-labelledby="privacy-document-title">
      <h2 id="privacy-document-title">{t("footer.privacy")}</h2>
      {documentText ? (
        <article className="legal-document">
          {metaLines.length > 0 && (
            <header className="legal-document__meta">
              <h1>{metaLines[0]}</h1>
              {metaLines.slice(1).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </header>
          )}
          {blocks
            .filter((block) => block.kind !== "meta")
            .map((block) =>
              block.kind === "heading" ? (
                <h3 key={block.text}>{block.text}</h3>
              ) : (
                <p key={block.text.slice(0, 80)}>{linkify(block.text)}</p>
              )
            )}
        </article>
      ) : (
        <p className="legal-placeholder">
          {failed
            ? "Die Datenschutzerklärung konnte nicht geladen werden."
            : "Datenschutzerklärung wird geladen …"}
        </p>
      )}
      <p>
        <a href={PRIVACY_DOCUMENT_PATH} target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung als Markdown öffnen
        </a>
      </p>
      <p>
        <a href="/datenschutzprinzipien">Klare Datenschutzprinzipien</a>
      </p>
    </section>
  );
}
