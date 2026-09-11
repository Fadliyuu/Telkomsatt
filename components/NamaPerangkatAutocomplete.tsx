"use client";

import { useEffect, useState, useMemo } from "react";
import { getUniqueNamaPerangkat } from "@/lib/firebase/sparepartItems";

interface NamaPerangkatAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
}

export default function NamaPerangkatAutocomplete({
  value,
  onChange,
  required,
  disabled,
  id = "namaPerangkat",
  placeholder = "Contoh: LNB C-Band 2 Watt",
}: NamaPerangkatAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUniqueNamaPerangkat()
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const listId = `${id}-datalist`;

  const filteredHint = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, 8);
    const q = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 12);
  }, [suggestions, value]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className="w-full px-4 py-3 border border-telkomsat-gray-lighter rounded-xl focus:ring-2 focus:ring-telkomsat-red focus:border-telkomsat-red outline-none transition-all duration-300 bg-telkomsat-gray-lighter/30 focus:bg-white"
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {suggestions.map((nama) => (
          <option key={nama} value={nama} />
        ))}
      </datalist>
      {!loading && value.trim() && filteredHint.length > 0 && (
        <p className="text-xs text-telkomsat-gray mt-1">
          {filteredHint.length} nama mirip di database — pilih dari dropdown atau ketik baru
        </p>
      )}
    </div>
  );
}
