import { useState, useCallback } from "react";

const MAX_HISTORY = 10;

export const useSearchHistory = (storageKey: string) => {
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });

  const addToHistory = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.toLowerCase() !== trimmed.toLowerCase());
        const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const removeFromHistory = useCallback(
    (term: string) => {
      setHistory((prev) => {
        const next = prev.filter((h) => h !== term);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const clearHistory = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHistory([]);
  }, [storageKey]);

  return { history, addToHistory, removeFromHistory, clearHistory };
};
