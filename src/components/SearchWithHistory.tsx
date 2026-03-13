import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Clock, Trash2 } from "lucide-react";
import { useSearchHistory } from "@/hooks/useSearchHistory";

interface SearchWithHistoryProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  storageKey: string;
}

const SearchWithHistory = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  storageKey,
}: SearchWithHistoryProps) => {
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { history, addToHistory, removeFromHistory, clearHistory } =
    useSearchHistory(storageKey);

  const showDropdown = focused && !value && history.length > 0;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (term: string) => {
    onChange(term);
    addToHistory(term);
    onSubmit?.(term);
    setFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      addToHistory(value.trim());
      onSubmit?.(value.trim());
      setFocused(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        className="pl-10 pr-9 bg-secondary/50 border-border/50"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">Recent searches</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearHistory();
              }}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
          {history.map((term) => (
            <button
              key={term}
              onClick={() => handleSelect(term)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-foreground hover:bg-accent/50 transition-colors group"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-left truncate">{term}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(term);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchWithHistory;
