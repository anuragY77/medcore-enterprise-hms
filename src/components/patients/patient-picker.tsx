"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

interface PatientPickerProps {
  value: string;
  onChange: (patientId: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface PickerPatient {
  id: string;
  patientId: string;
  displayName: string;
  department: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

function toPickerPatient(p: Patient): PickerPatient {
  return {
    id: p.id,
    patientId: p.patientId,
    displayName: `${p.firstName} ${p.lastName}`,
    department: p.department,
  };
}

function patientLabel(p: PickerPatient): string {
  return `${p.displayName} (${p.patientId})`;
}

export function PatientPicker({
  value,
  onChange,
  label = "Patient",
  error,
  required,
  className,
}: PatientPickerProps) {
  const inputId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [resolved, setResolved] = useState<PickerPatient | null>(null);
  const [results, setResults] = useState<PickerPatient[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(-1);

  const selected = value && resolved && resolved.id === value ? resolved : null;

  const search = useCallback(async (query: string) => {
    lastQueryRef.current = query;
    try {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      params.set("pageSize", String(MAX_RESULTS));
      const res = await fetch(`/api/patients?${params.toString()}`);
      if (res.status === 401 || res.status === 403) {
        throw new Error("You do not have permission to search patients.");
      }
      if (!res.ok) throw new Error("Failed to search patients.");
      const payload = await res.json();
      if (!Array.isArray(payload.patients)) {
        throw new Error("Received an unexpected response from the server.");
      }
      setResults(payload.patients.map(toPickerPatient));
    } catch (err) {
      setResults([]);
      setLoadError(err instanceof Error ? err.message : "Failed to search patients.");
    } finally {
      setLoading(false);
    }
  }, []);

  const searchQuery =
    selected && inputValue === patientLabel(selected) ? "" : inputValue.trim();

  useEffect(() => {
    if (!value || (resolved && resolved.id === value)) return;
    let cancelled = false;
    const resolve = async () => {
      try {
        const res = await fetch(`/api/patients/${value}`);
        if (!res.ok) return;
        const payload = await res.json();
        if (cancelled || !payload?.id) return;
        const mapped = toPickerPatient(payload);
        setResolved(mapped);
        setInputValue((prev) => (prev === "" ? patientLabel(mapped) : prev));
      } catch {
        // Keep the raw id visible if resolution fails.
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [value, resolved]);

  useEffect(() => {
    if (!open) return;
    const q = searchQuery;
    if (q === lastQueryRef.current) return;
    const timer = setTimeout(() => {
      search(q);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, searchQuery, search]);

  useEffect(() => {
    if (!open) return;
    const onDocumentPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentPointer);
    return () => document.removeEventListener("mousedown", onDocumentPointer);
  }, [open]);

  const openDropdown = () => {
    setOpen(true);
    setHighlighted(-1);
    search(searchQuery);
  };

  const handleInputChange = (next: string) => {
    setInputValue(next);
    setHighlighted(-1);
    if (selected && next !== patientLabel(selected)) {
      onChange("");
      setResolved(null);
    }
  };

  const handleSelect = (patient: PickerPatient) => {
    onChange(patient.id);
    setResolved(patient);
    setInputValue(patientLabel(patient));
    setOpen(false);
    setHighlighted(-1);
  };

  const handleClear = () => {
    onChange("");
    setResolved(null);
    setInputValue("");
    setLoadError(null);
    lastQueryRef.current = null;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      setHighlighted((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      if (open && highlighted >= 0 && highlighted < results.length) {
        event.preventDefault();
        handleSelect(results[highlighted]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  const displayValue =
    inputValue || (value && !selected ? value : "");

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>

      <div className="relative" ref={containerRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && highlighted >= 0 ? `${listId}-option-${highlighted}` : undefined
          }
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={(e) => {
            openDropdown();
            e.currentTarget.select();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, ID, phone, or email..."
          className="w-full pl-9 pr-16 py-2.5 text-sm bg-card border border-border/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-muted-foreground"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selected patient"
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border/50 rounded-lg shadow-lg overflow-hidden">
          {loadError ? (
            <p className="px-3 py-3 text-sm text-destructive">{loadError}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {loading ? "Searching..." : "No patients found."}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Patient results"
              className="max-h-64 overflow-y-auto py-1"
            >
              {results.map((patient, index) => (
                <li
                  key={patient.id}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlighted}
                  onClick={() => handleSelect(patient)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-sm",
                    index === highlighted ? "bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {patient.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    <span className="font-mono">{patient.patientId}</span>
                    <span className="hidden sm:inline">{patient.department}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
