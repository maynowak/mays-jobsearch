import { useEffect, useState } from "react";
import { fetchModel } from "../api";

export default function ModelInfo() {
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModel()
      .then((m) => {
        if (!cancelled) setModel(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!model) return null;
  return <p className="model-info">AI model: {model}</p>;
}