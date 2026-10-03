/**
 * Filter sidebar component with all search options
 */

import { useState } from 'react';
import { SearchOptions } from '../types';
import { SELLER_COUNTRIES } from '../data/countries';
import { QUICK_STYLES } from '../data/styles';
import { FAVOURITE_SELLERS } from '../data/sellers';
import './FilterSidebar.css';

/** Split the comma-separated Styles field into trimmed, non-empty tokens. */
function parseStyles(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface ClearableInputProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** id of a <datalist> offering suggestions for this input. */
  list?: string;
}

/** Text/number input with a clear (×) button that appears when it has content. */
function ClearableInput({
  id,
  value,
  onValueChange,
  placeholder,
  type = 'text',
  min,
  max,
  disabled,
  list,
}: ClearableInputProps) {
  return (
    <div className="input-clearable">
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        disabled={disabled}
        list={list}
      />
      {value && !disabled && (
        <button
          type="button"
          className="input-clear"
          onClick={() => onValueChange('')}
          aria-label="Clear"
          tabIndex={-1}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface FilterSidebarProps {
  onSearch: (options: SearchOptions) => void;
  isSearching: boolean;
}

export function FilterSidebar({ onSearch, isSearching }: FilterSidebarProps) {
  const [styles, setStyles] = useState<string>('');
  const [artist, setArtist] = useState('');
  const [seller, setSeller] = useState('');
  const [genre, setGenre] = useState('');
  const [format, setFormat] = useState('Vinyl');
  const [fromCountry, setFromCountry] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [currency, setCurrency] = useState('');
  const [condition, setCondition] = useState('');
  const [formatDescription, setFormatDescription] = useState('');
  const [sort, setSort] = useState('price,asc');
  const [labelId, setLabelId] = useState('');
  const [masterId, setMasterId] = useState('');
  const [releaseId, setReleaseId] = useState('');
  const [artistId, setArtistId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStyleChips, setShowStyleChips] = useState(false);

  // The Styles text field is the single source of truth; chips just toggle a
  // value in it. Compare case-insensitively so a manually-typed style still
  // lights up its chip.
  const activeStyles = new Set(parseStyles(styles).map((s) => s.toLowerCase()));

  const toggleStyle = (style: string) => {
    const tokens = parseStyles(styles);
    const idx = tokens.findIndex((t) => t.toLowerCase() === style.toLowerCase());
    const next = idx >= 0
      ? tokens.filter((_, i) => i !== idx)
      : [...tokens, style];
    setStyles(next.join(', '));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse styles from comma-separated string
    const styleArray = parseStyles(styles);

    const options: SearchOptions = {
      pageDelayMs: 1000
    };

    if (styleArray.length > 0) options.styles = styleArray;
    if (artist) options.artist = artist;
    if (seller) options.seller = seller;
    if (genre) options.genre = genre;
    if (format) options.format = format;
    if (fromCountry) options.fromCountry = fromCountry;
    if (minYear) options.minYear = parseInt(minYear);
    if (maxYear) options.maxYear = parseInt(maxYear);
    if (currency) options.currency = currency;
    if (condition) options.condition = condition;
    if (formatDescription) options.formatDescription = formatDescription;
    if (sort) options.sort = sort;
    if (labelId) options.labelId = parseInt(labelId);
    if (masterId) options.masterId = parseInt(masterId);
    if (releaseId) options.releaseId = parseInt(releaseId);
    if (artistId) options.artistId = parseInt(artistId);

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
        <div className="filter-scroll">
        <div className="filter-group">
          <label htmlFor="artist">General Search</label>
          <ClearableInput
            id="artist"
            value={artist}
            onValueChange={setArtist}
            placeholder="Artist, title, label, cat# …"
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="styles">Styles (exact, comma-separated)</label>
          <ClearableInput
            id="styles"
            value={styles}
            onValueChange={setStyles}
            placeholder="Type any style, or tap the chips below"
            disabled={isSearching}
          />

          <button
            type="button"
            className="style-chips-toggle"
            onClick={() => setShowStyleChips((v) => !v)}
            aria-expanded={showStyleChips}
          >
            <span className={`advanced-caret ${showStyleChips ? 'open' : ''}`}>▸</span>
            Quick styles
            {activeStyles.size > 0 && (
              <span className="style-chips-count">{activeStyles.size}</span>
            )}
          </button>

          {showStyleChips && (
            <div className="style-chips-body">
              <div className="style-chips">
                {QUICK_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`style-chip ${activeStyles.has(style.toLowerCase()) ? 'active' : ''}`}
                    onClick={() => toggleStyle(style)}
                    disabled={isSearching}
                    aria-pressed={activeStyles.has(style.toLowerCase())}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="genre">Genre</label>
          <ClearableInput
            id="genre"
            value={genre}
            onValueChange={setGenre}
            placeholder="Rock, Electronic, Jazz, etc."
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="seller">Seller</label>
          <ClearableInput
            id="seller"
            value={seller}
            onValueChange={setSeller}
            placeholder="Discogs seller username"
            disabled={isSearching}
            list="seller-suggestions"
          />
          <datalist id="seller-suggestions">
            {FAVOURITE_SELLERS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
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
          <select
            id="fromCountry"
            value={fromCountry}
            onChange={(e) => setFromCountry(e.target.value)}
            disabled={isSearching}
          >
            <option value="">Any Country</option>
            {SELLER_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="minYear">Min Year</label>
          <ClearableInput
            type="number"
            id="minYear"
            value={minYear}
            onValueChange={setMinYear}
            placeholder="1970"
            min="1900"
            max="2100"
            disabled={isSearching}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="maxYear">Max Year</label>
          <ClearableInput
            type="number"
            id="maxYear"
            value={maxYear}
            onValueChange={setMaxYear}
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
          <ClearableInput
            id="formatDescription"
            value={formatDescription}
            onValueChange={setFormatDescription}
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

        <button
          type="button"
          className="filter-advanced-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <span className={`advanced-caret ${showAdvanced ? 'open' : ''}`}>▸</span>
          Advanced — search by Discogs ID
        </button>

        {showAdvanced && (
          <div className="filter-advanced-body">
            <p className="filter-advanced-hint">
              Use one at a time. Find the ID in a Discogs URL, e.g. /release/<strong>12345</strong>.
            </p>

            <div className="filter-group">
              <label htmlFor="releaseId">Release ID</label>
              <ClearableInput
                type="number"
                id="releaseId"
                value={releaseId}
                onValueChange={setReleaseId}
                placeholder="All listings for one pressing"
                min="1"
                disabled={isSearching}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="masterId">Master ID</label>
              <ClearableInput
                type="number"
                id="masterId"
                value={masterId}
                onValueChange={setMasterId}
                placeholder="All pressings of an album"
                min="1"
                disabled={isSearching}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="labelId">Label ID</label>
              <ClearableInput
                type="number"
                id="labelId"
                value={labelId}
                onValueChange={setLabelId}
                placeholder="All listings for a label"
                min="1"
                disabled={isSearching}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="artistId">Artist ID</label>
              <ClearableInput
                type="number"
                id="artistId"
                value={artistId}
                onValueChange={setArtistId}
                placeholder="All listings for an artist"
                min="1"
                disabled={isSearching}
              />
            </div>
          </div>
        )}
        </div>

        <div className="search-footer">
          <button type="submit" disabled={isSearching} className="search-button">
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
    </div>
  );
}
