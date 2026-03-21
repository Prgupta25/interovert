import React, { useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, ChevronDown, Calendar, X } from 'lucide-react';

const inputCls =
  'rounded-xl border border-zinc-600/60 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 [color-scheme:dark]';

export default function EventFilters({
  categories,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  filterMenuOpen,
  setFilterMenuOpen,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filterMenuOpen, setFilterMenuOpen]);

  const pill = (active) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/40 ring-1 ring-white/10'
        : 'bg-zinc-800/80 text-zinc-400 ring-1 ring-zinc-700/80 hover:bg-zinc-800 hover:text-zinc-200'
    }`;

  return (
    <div className="mb-10 space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          placeholder="Search by title, description, or place…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border border-zinc-700/60 bg-zinc-900/60 py-3.5 pl-12 pr-4 text-sm text-white shadow-inner shadow-black/20 placeholder:text-zinc-500 focus:border-indigo-500/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          autoComplete="off"
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
        <button type="button" onClick={() => setSelectedCategory('all')} className={pill(selectedCategory === 'all')}>
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={pill(selectedCategory === category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 ring-1 ring-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterMenuOpen(!filterMenuOpen)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600/60 bg-zinc-800/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            Sort & filters
            <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${filterMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterMenuOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-zinc-700 bg-zinc-900 py-3 shadow-2xl shadow-black/50 ring-1 ring-white/5">
              <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Sort by</p>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800/80">
                <input
                  type="radio"
                  name="sortBy"
                  checked={sortBy === 'date'}
                  onChange={() => setSortBy('date')}
                  className="h-4 w-4 border-zinc-600 text-indigo-600 focus:ring-indigo-500"
                />
                Date
              </label>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800/80">
                <input
                  type="radio"
                  name="sortBy"
                  checked={sortBy === 'name'}
                  onChange={() => setSortBy('name')}
                  className="h-4 w-4 border-zinc-600 text-indigo-600 focus:ring-indigo-500"
                />
                Name
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <Calendar className="h-4 w-4 text-indigo-400" />
            Date range
          </span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          <span className="text-zinc-600">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
              Clear dates
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
