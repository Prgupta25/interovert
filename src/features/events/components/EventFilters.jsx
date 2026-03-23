import React, { useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  MapPin,
  Navigation,
  SlidersHorizontal,
  UserCircle2,
} from 'lucide-react';

const RADIUS_OPTIONS = [10, 25, 50, 100];

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
  nearMe,
  setNearMe,
  radius,
  setRadius,
  userAddress,
  myEvents,
  setMyEvents,
  currentUser,
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

      <div className="flex flex-wrap items-center gap-4">
        {/* Filter & Sort dropdown — disabled when Near Me is active since geo sort takes over */}
        <div className="relative">
          <button
            onClick={() => !nearMe && setFilterMenuOpen(!filterMenuOpen)}
            disabled={nearMe}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              nearMe
                ? 'bg-gray-800 opacity-40 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            Sort & filters
            <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${filterMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterMenuOpen && !nearMe && (
            <div className="absolute mt-2 w-48 bg-gray-800 rounded-lg shadow-lg z-10">
              <div className="p-4 space-y-2">
                <h3 className="font-semibold mb-2">Sort by</h3>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={sortBy === 'date'}
                    onChange={() => setSortBy('date')}
                    className="form-radio text-indigo-600"
                  />
                  <span>Date</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={sortBy === 'name'}
                    onChange={() => setSortBy('name')}
                    className="form-radio text-indigo-600"
                  />
                  <span>Name</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* My Events — only shown when logged in */}
        {currentUser && (
          <button
            onClick={() => setMyEvents(!myEvents)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              myEvents
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <UserCircle2 size={16} />
            My Events
          </button>
        )}

        {/* Near Me — only rendered when the user has a saved address with geocode */}
        {userAddress && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNearMe(!nearMe)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                nearMe
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <Navigation size={16} className={nearMe ? 'text-white' : 'text-gray-400'} />
              Near Me
            </button>

            {/* Radius selector — only visible when Near Me is on */}
            {nearMe && (
              <div className="flex items-center gap-1">
                {RADIUS_OPTIONS.map((km) => (
                  <button
                    key={km}
                    onClick={() => setRadius(km)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      radius === km
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {km}km
                  </button>
                ))}
              </div>
            )}

            {/* Show which address is being used */}
            {nearMe && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={12} />
                {userAddress.label || userAddress.city}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
