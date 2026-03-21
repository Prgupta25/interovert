import React from 'react';
import { Search, Filter, ChevronDown, Calendar, MapPin, Navigation } from 'lucide-react';

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
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  nearMe,
  setNearMe,
  radius,
  setRadius,
  userAddress,
}) {
  return (
    <div className="space-y-4 mb-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-800 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap ${
            selectedCategory === 'all' ? 'bg-indigo-600' : 'bg-gray-800'
          }`}
        >
          All Events
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              selectedCategory === category ? 'bg-indigo-600' : 'bg-gray-800'
            }`}
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
            <Filter size={20} />
            Filter & Sort
            <ChevronDown size={16} className={`transform transition-transform ${filterMenuOpen ? 'rotate-180' : ''}`} />
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

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            placeholder="From"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-400 hover:text-white ml-1"
            >
              Clear
            </button>
          )}
        </div>

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
