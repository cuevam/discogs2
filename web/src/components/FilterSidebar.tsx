/**
 * Filter sidebar component with all search options
 */

import { useState } from 'react';
import { SearchOptions } from '../types';
import './FilterSidebar.css';

interface FilterSidebarProps {
  onSearch: (options: SearchOptions) => void;
  isSearching: boolean;
}

export function FilterSidebar({ onSearch, isSearching }: FilterSidebarProps) {
  const [styles, setStyles] = useState<string>('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [format, setFormat] = useState('Vinyl');
  const [fromCountry, setFromCountry] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [currency, setCurrency] = useState('');
  const [condition, setCondition] = useState('');
  const [formatDescription, setFormatDescription] = useState('');
  const [sort, setSort] = useState('listed,desc');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse styles from comma-separated string
    const styleArray = styles
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const options: SearchOptions = {
      pageDelayMs: 1000
    };

    if (styleArray.length > 0) options.styles = styleArray;
    if (artist) options.artist = artist;
    if (genre) options.genre = genre;
    if (format) options.format = format;
    if (fromCountry) options.fromCountry = fromCountry;
    if (minYear) options.minYear = parseInt(minYear);
    if (maxYear) options.maxYear = parseInt(maxYear);
    if (currency) options.currency = currency;
    if (condition) options.condition = condition;
    if (formatDescription) options.formatDescription = formatDescription;
    if (sort) options.sort = sort;

    // Warn if completely empty
    if (Object.keys(options).length === 1) { // Only pageDelayMs
      if (!confirm('No filters selected. This will search all listings. Continue?')) {
        return;
      }
    }

    onSearch(options);
  };

  return (
    <div className="filter-sidebar">
      <form onSubmit={handleSubmit}>
        <div className="filter-group">
          <label htmlFor="styles">Styles (comma-separated)</label>
          <input
            type="text"
            id="styles"
            value={styles}
            onChange={(e) => setStyles(e.target.value)}
            placeholder="Krautrock, Prog Rock, Psychedelic"
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="artist">Artist</label>
          <input
            type="text"
            id="artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Search by artist name"
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="genre">Genre</label>
          <input
            type="text"
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Rock, Electronic, Jazz, etc."
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="format">Format</label>
          <select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={isSearching}
          >
            <option value="">All Formats</option>
            <option value="Vinyl">Vinyl</option>
            <option value="CD">CD</option>
            <option value="Cassette">Cassette</option>
            <option value="DVD">DVD</option>
            <option value="Blu-ray">Blu-ray</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="fromCountry">Seller Country</label>
          <input
            type="text"
            id="fromCountry"
            value={fromCountry}
            onChange={(e) => setFromCountry(e.target.value)}
            placeholder="US, DE, FR, GB, JP, etc."
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="minYear">Min Year</label>
          <input
            type="number"
            id="minYear"
            value={minYear}
            onChange={(e) => setMinYear(e.target.value)}
            placeholder="1970"
            min="1900"
            max="2100"
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxYear">Max Year</label>
          <input
            type="number"
            id="maxYear"
            value={maxYear}
            onChange={(e) => setMaxYear(e.target.value)}
            placeholder="2024"
            min="1900"
            max="2100"
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isSearching}
          >
            <option value="">All Currencies</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="condition">Condition</label>
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            disabled={isSearching}
          >
            <option value="">All Conditions</option>
            <option value="Mint (M)">Mint (M)</option>
            <option value="Near Mint (NM or M-)">Near Mint (NM or M-)</option>
            <option value="Very Good Plus (VG+)">Very Good Plus (VG+)</option>
            <option value="Very Good (VG)">Very Good (VG)</option>
            <option value="Good Plus (G+)">Good Plus (G+)</option>
            <option value="Good (G)">Good (G)</option>
            <option value="Fair (F)">Fair (F)</option>
            <option value="Poor (P)">Poor (P)</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="formatDescription">Format Description</label>
          <input
            type="text"
            id="formatDescription"
            value={formatDescription}
            onChange={(e) => setFormatDescription(e.target.value)}
            placeholder="LP, 12&quot;, 7&quot;, etc."
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="sort">Sort By</label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            disabled={isSearching}
          >
            <option value="listed,desc">Listed: Newest</option>
            <option value="listed,asc">Listed: Oldest</option>
            <option value="price,desc">Price: High to Low</option>
            <option value="price,asc">Price: Low to High</option>
            <option value="artist,desc">Artist: Z-A</option>
            <option value="artist,asc">Artist: A-Z</option>
            <option value="title,desc">Title: Z-A</option>
            <option value="title,asc">Title: A-Z</option>
            <option value="label,desc">Label: Z-A</option>
            <option value="label,asc">Label: A-Z</option>
            <option value="catno,desc">Cat#: Z-A</option>
            <option value="catno,asc">Cat#: A-Z</option>
            <option value="seller,desc">Seller: Z-A</option>
            <option value="seller,asc">Seller: A-Z</option>
          </select>
        </div>

        <button type="submit" disabled={isSearching} className="search-button">
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  );
}
