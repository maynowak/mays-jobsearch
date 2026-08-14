import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

export interface CitySuggestion {
  key: string;
  postalCode: string;
  name: string;
}

interface OpenPlzLocality {
  postalCode: string;
  name: string;
  district?: { name: string };
  municipality?: { name: string };
  federalState?: { name: string };
}

const MIN_LENGTH = 3;
const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 8;
const OPENPLZ_URL = "https://openplzapi.org/de/Localities";

function dedupeLocations(list: OpenPlzLocality[]): OpenPlzLocality[] {
  const seen = new Set<string>();
  return list.filter((loc) => {
    const key = `${loc.postalCode}|${loc.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useCityAutocomplete(): {
  city: string;
  suggestions: CitySuggestion[];
  open: boolean;
  loading: boolean;
  active: number;
  boxRef: RefObject<HTMLDivElement | null>;
  handleChange: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  select: (suggestion: CitySuggestion) => void;
} {
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const debounceRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const runQuery = async (query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("pageSize", String(MAX_SUGGESTIONS));
    params.set(/^\d+$/.test(query) ? "postalCode" : "name", query);

    try {
      const res = await fetch(`${OPENPLZ_URL}?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("OpenPLZ request failed");
      const data = (await res.json()) as OpenPlzLocality[];
      const list = dedupeLocations(data)
        .slice(0, MAX_SUGGESTIONS)
        .map((loc) => ({
          key: `${loc.postalCode}|${loc.name}`,
          postalCode: loc.postalCode,
          name: loc.name,
        }));
      setSuggestions(list);
      setLoading(false);
      setOpen(list.length > 0);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSuggestions([]);
        setLoading(false);
        setOpen(false);
      }
    }
  };

  const handleChange = (value: string) => {
    setCity(value);
    setActive(-1);
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < MIN_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    debounceRef.current = window.setTimeout(() => {
      void runQuery(trimmed);
    }, DEBOUNCE_MS);
  };

  const select = (suggestion: CitySuggestion) => {
    setCity(suggestion.name);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (active >= 0 && active < suggestions.length) {
        event.preventDefault();
        select(suggestions[active]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return {
    city,
    suggestions,
    open,
    loading,
    active,
    boxRef,
    handleChange,
    handleKeyDown,
    select,
  };
}