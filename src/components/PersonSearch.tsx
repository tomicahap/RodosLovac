// PersonSearch — autocomplete search across all persons
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useApp } from '../context/AppContext';
import type { GedcomPerson } from '../parser/gedcomTypes';

interface Props {
  onSelect?: (id: string) => void;
  placeholder?: string;
  value?: string | null;
  className?: string;
}

export default function PersonSearch({ onSelect, placeholder = 'Pretraži osobu...', value, className = '' }: Props) {
  const { tree, setSelectedPerson, selectedPersonId } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const persons = useMemo(() => {
    if (!tree) return [];
    return Array.from(tree.persons.values());
  }, [tree]);

  const fuse = useMemo(() => new Fuse(persons, {
    keys: ['names.full', 'names.given', 'names.surname'],
    threshold: 0.4,
    minMatchCharLength: 1,
  }), [persons]);

  const results = useMemo(() => {
    if (!query.trim()) return persons.slice(0, 10);
    return fuse.search(query).map(r => r.item).slice(0, 10);
  }, [query, fuse, persons]);

  const selectedPerson = useMemo(() => {
    const id = value ?? selectedPersonId;
    if (!id || !tree) return null;
    return tree.persons.get(id) || null;
  }, [value, selectedPersonId, tree]);

  useEffect(() => {
    if (!focused) {
      setQuery(selectedPerson?.names[0]?.full || '');
    }
  }, [selectedPerson, focused]);

  const handleSelect = (p: GedcomPerson) => {
    setQuery(p.names[0]?.full || '');
    setOpen(false);
    if (onSelect) onSelect(p.id);
    else setSelectedPerson(p.id);
  };

  const getDisplayDate = (p: GedcomPerson) => {
    const b = p.birth?.date?.year;
    const d = p.death?.date?.year;
    if (b && d) return `${b}–${d}`;
    if (b) return `r. ${b}`;
    return '';
  };

  if (!tree) return null;

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        className="input pr-8"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => { setTimeout(() => { setOpen(false); setFocused(false); }, 150); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </span>
      {open && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl overflow-hidden"
          style={{ maxHeight: 320, overflowY: 'auto' }}
        >
          {results.map(p => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-secondary)] flex items-center gap-3 transition-colors"
              onMouseDown={() => handleSelect(p)}
            >
              <span className={`text-lg ${p.sex === 'M' ? 'gender-m' : p.sex === 'F' ? 'gender-f' : 'gender-u'}`}>
                {p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '?'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-[var(--text-primary)] truncate">{p.names[0]?.full}</div>
                <div className="text-xs text-[var(--text-muted)]">{getDisplayDate(p)}{p.birth?.place ? ` · ${p.birth.place.split(',')[0]}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
