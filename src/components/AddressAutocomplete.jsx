import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, MapPin, Loader2, X } from 'lucide-react'

/**
 * Parses a Nominatim result's `address` block into our form fields.
 */
function parseNominatim(result) {
  const a = result.address || {}
  const line1 =
    [a.house_number, a.road].filter(Boolean).join(' ') ||
    a.neighbourhood ||
    a.suburb ||
    ''
  const city =
    a.city || a.town || a.village || a.municipality || a.county || ''
  return {
    line1,
    city,
    state:      a.state       || '',
    country:    a.country     || '',
    postalCode: a.postcode    || '',
  }
}

/**
 * AddressAutocomplete
 *
 * Props:
 *   onSelect(fields)   – called with { line1, city, state, country, postalCode }
 *                        when the user picks a suggestion
 *   placeholder        – input placeholder text
 *   inputClassName     – extra classes for the input
 */
export default function AddressAutocomplete({ onSelect, placeholder = 'Search address to autofill…', inputClassName = '' }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)

  const debounceRef  = useRef(null)
  const containerRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const search = useCallback(async (q) => {
    if (!q || q.length < 3) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', q)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '6')
      url.searchParams.set('addressdetails', '1')
      const res  = await fetch(url.toString())
      const data = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 420)
  }

  const handleSelect = (result) => {
    setQuery(result.display_name)
    setOpen(false)
    onSelect(parseNominatim(result))
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border focus:outline-none transition-colors ${inputClassName}`}
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin pointer-events-none"
          />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-700 flex items-start gap-2 transition-colors"
              >
                <MapPin size={13} className="text-indigo-400 mt-0.5 shrink-0" />
                <span className="text-gray-200 text-xs leading-snug line-clamp-2">
                  {r.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
