import { useState, useEffect, useRef } from 'react';
import { FilterSidebar } from './components/FilterSidebar';
import { ProgressBar } from './components/ProgressBar';
import { ResultsTable } from './components/ResultsTable';
import { EstimateModal } from './components/EstimateModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SearchOptions, ListingData, ProgressUpdate, EstimateResult } from './types';
import './App.css';

// Use the same host the page was loaded from, so it works when opened from
// another device on the LAN (e.g. a phone) instead of only on localhost.
const API_URL = `${window.location.protocol}//${window.location.hostname}:3001`;

function App() {
  const [listings, setListings] = useState<ListingData[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [pendingOptions, setPendingOptions] = useState<SearchOptions | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Step 1: click Search -> cheap probe to preview the cost, then open the modal.
  const handleSearch = async (options: SearchOptions) => {
    // Abort any ongoing stream and reset the view.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setListings([]);
    setProgress(null);
    setIsSearching(false);
    setEstimate(null);
    setIsEstimating(true);
    setSearchResetKey(prev => prev + 1);

    try {
      const response = await fetch(`${API_URL}/api/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429 || data.rateLimited) {
          throw new Error('Discogs is rate-limiting right now. Wait a minute and try again.');
        }
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      const result: EstimateResult = await response.json();
      setEstimate(result);
      setPendingOptions(options);
    } catch (error) {
      console.error('Error during estimate:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEstimating(false);
    }
  };

  // Modal: fetch everything (paced by the server's rate limiter).
  const handleFetchAll = () => {
    const options = pendingOptions;
    setEstimate(null);
    if (options) runStream(options);
  };

  // Modal: take just the first page — already loaded by the probe, so instant.
  const handleFirstPage = () => {
    if (estimate) setListings(estimate.firstPageItems);
    setEstimate(null);
  };

  const handleCloseEstimate = () => {
    setEstimate(null);
  };

  // Step 2: stream the chosen search from the server via SSE.
  const runStream = async (options: SearchOptions) => {
    setListings([]);
    setProgress(null);
    setIsSearching(true);

    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Use fetch to POST the search options, then upgrade to EventSource
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      const newListings: ListingData[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Split on SSE event delimiter (double newline)
        const events = buffer.split('\n\n');
        // Keep the last incomplete event in the buffer
        buffer = events.pop() || '';

        for (const event of events) {
          // Ignore empty events and comments
          if (!event.trim() || event.startsWith(':')) continue;

          // Parse SSE event
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  setProgress({
                    currentPage: data.currentPage,
                    totalPages: data.totalPages,
                    itemsLoaded: data.itemsLoaded,
                    isComplete: data.isComplete,
                  });
                } else if (data.type === 'data') {
                  newListings.push(data.listing);
                  // Update listings in batches for better performance
                  if (newListings.length % 50 === 0) {
                    setListings([...newListings]);
                  }
                } else if (data.type === 'complete') {
                  setListings([...newListings]);
                  setIsSearching(false);
                } else if (data.type === 'error') {
                  console.error('Search error:', data.message);
                  alert(`Error: ${data.message}`);
                  setIsSearching(false);
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line, e);
              }
            }
          }
        }
      }

      // Final update
      setListings([...newListings]);
      setIsSearching(false);
    } catch (error) {
      // Ignore abort errors (user cancelled)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      console.error('Error during search:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSearching(false);
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsSearching(false);
    setProgress(null);
  };

  const handleExportCSV = () => {
    if (listings.length === 0) return;

    // CSV header
    const header = [
      'title', 'artists', 'formats',
      'price', 'shipping', 'total', 'currency',
      'have', 'want',
      'seller_name', 'seller_url', 'seller_score',
      'seller_country_name', 'seller_country_code',
      'year', 'decade',
      'condition_media', 'condition_sleeve',
      'labels', 'catalog_numbers',
      'description',
      'listed_at',
      'listing_url',
      'release_id', 'release_url',
      'image_url'
    ].join(',');

    // CSV rows
    const rows = listings.map(listing => {
      const escapeCsv = (value: any) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(listing.title),
        escapeCsv(listing.artists),
        escapeCsv(listing.formats),
        escapeCsv(listing.price),
        escapeCsv(listing.shipping),
        escapeCsv(listing.total),
        escapeCsv(listing.currency),
        escapeCsv(listing.have),
        escapeCsv(listing.want),
        escapeCsv(listing.seller_name),
        escapeCsv(listing.seller_url),
        escapeCsv(listing.seller_score),
        escapeCsv(listing.seller_country_name),
        escapeCsv(listing.seller_country_code),
        escapeCsv(listing.year),
        escapeCsv(listing.decade),
        escapeCsv(listing.condition_media),
        escapeCsv(listing.condition_sleeve),
        escapeCsv(listing.labels),
        escapeCsv(listing.catalog_numbers),
        escapeCsv(listing.description),
        escapeCsv(listing.listed_at),
        escapeCsv(listing.listing_url),
        escapeCsv(listing.release_id),
        escapeCsv(listing.release_url),
        escapeCsv(listing.image_url)
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discogs-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      {showSidebar && <FilterSidebar onSearch={handleSearch} isSearching={isSearching || isEstimating} />}
      {isEstimating && (
        <LoadingOverlay
          message="Checking Discogs"
          detail="Counting how many listings match your filters"
        />
      )}
      {estimate && (
        <EstimateModal
          estimate={estimate}
          onFetchAll={handleFetchAll}
          onFirstPage={handleFirstPage}
          onCancel={handleCloseEstimate}
        />
      )}
      <div className="main-content">
        {isSearching && <ProgressBar progress={progress} onCancel={handleCancel} />}
        <ResultsTable 
          data={listings} 
          onExportCSV={handleExportCSV} 
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          resetKey={searchResetKey}
        />
      </div>
    </div>
  );
}

export default App;
