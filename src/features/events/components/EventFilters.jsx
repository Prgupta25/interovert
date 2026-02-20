import React from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';

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

      <div className="relative">
        <button
          onClick={() => setFilterMenuOpen(!filterMenuOpen)}
          className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Filter size={20} />
          Filter & Sort
          <ChevronDown size={16} className={`transform transition-transform ${filterMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {filterMenuOpen && (
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
    </div>
  );
}
