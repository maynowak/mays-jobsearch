import { useEffect, useState } from "react";
import type { Job, Profile } from "../types";
import { generateCoverLetter } from "../api";

interface Props {
  job: Job;
  prepare: string;
  profile: Profile;
  onClose: () => void;
}

export default function LetterModal({ job, prepare, profile, onClose }: Props) {
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setLetter("");
    generateCoverLetter(profile, job, prepare)
      .then((text) => {
        if (cancelled) return;
        setLetter(text);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || "Couldn't generate the letter.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, prepare, profile]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  };

  const handleDownload = () => {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName =
      `${job.title} ${job.company_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      "bewerbung";
    a.download = `anschreiben-${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const jobName = [job.title, job.company_name].filter(Boolean).join(" @ ");

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Bewerbungsschreiben">
        <div className="modal-head">
          <div>
            <h3>Bewerbungsschreiben</h3>
            <p className="modal-sub">{jobName}</p>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        {loading && (
          <div className="letter-loading">
            <span className="spinner" />
            Dein Anschreiben wird geschrieben…
          </div>
        )}

        {!loading && error && (
          <div className="letter-output">Fehler beim Generieren: {error}</div>
        )}

        {!loading && !error && (
          <div className="letter-output">{letter}</div>
        )}

        {!loading && !error && (
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={handleCopy}>
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
            <button type="button" className="btn-ghost" onClick={handleDownload}>
              Download .txt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}