// LocationSearch.jsx
// Live OpenStreetMap Nominatim search bar for finding ANY real place in Jodhpur / India

import { useState } from 'react';
import axios from 'axios';

export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      // OpenStreetMap Nominatim API (Free public geocoding)
      // Jodhpur viewbox coordinates to prioritize Jodhpur results
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query.includes('Jodhpur') ? query : `${query}, Jodhpur`,
          format: 'json',
          addressdetails: 1,
          limit: 5,
        },
      });
      setResults(res.data);
      setShowDropdown(true);
    } catch (err) {
      console.error('Geocoding search failed:', err);
    } finally {
      setSearching(false);
    }
  }

  function handleSelect(item) {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const displayName = item.display_name.split(',')[0] + ' (' + (item.address?.suburb || item.address?.neighbourhood || 'Jodhpur') + ')';

    onLocationSelect({
      name: displayName,
      lat,
      lng: lon,
    });

    setQuery('');
    setResults([]);
    setShowDropdown(false);
  }

  return (
    <div style={{ position: 'relative', marginBottom: '1rem' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.4rem' }}>
        <input
          type="text"
          placeholder="🔍 Search any Jodhpur place (e.g. Mehrangarh, Mandore...)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1,
            background: '#1e293b',
            border: '1px solid #38bdf8',
            color: '#f8fafc',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.82rem',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={searching}
          style={{ width: 'auto', padding: '0.5rem 0.8rem', whiteSpace: 'nowrap' }}
        >
          {searching ? '...' : 'Search'}
        </button>
      </form>

      {/* Auto-suggest dropdown */}
      {showDropdown && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          marginTop: '0.3rem',
          zIndex: 9999,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.7)',
          maxHeight: '220px',
          overflowY: 'auto',
        }}>
          {results.map((item, i) => (
            <div
              key={i}
              onClick={() => handleSelect(item)}
              style={{
                padding: '0.6rem 0.8rem',
                borderBottom: i < results.length - 1 ? '1px solid #1e293b' : 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                color: '#e2e8f0',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
              onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
            >
              <div style={{ fontWeight: 600, color: '#38bdf8' }}>
                📍 {item.display_name.split(',')[0]}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.display_name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
