/**
 * Search cost preview modal.
 *
 * Shown after the cheap "probe" request returns. Displays the exact totals from
 * Discogs and how much a full fetch would cost (requests + time) under the safe
 * rate limit, then lets the user fetch everything, take just the first page
 * (instant — already loaded by the probe), or cancel.
 */

import { EstimateResult } from '../types';
import './EstimateModal.css';

interface EstimateModalProps {
  estimate: EstimateResult;
  onFetchAll: () => void;
  onFirstPage: () => void;
  onCancel: () => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds <= 0) return 'instant';
  if (totalSeconds < 60) return `~${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `~${minutes}m` : `~${minutes}m ${seconds}s`;
}

export function EstimateModal({ estimate, onFetchAll, onFirstPage, onCancel }: EstimateModalProps) {
  const {
    totalItems, perPage, cappedPages, fetchableItems,
    requestsForAll, estimatedTimeMsAll, rateDescription,
  } = estimate;

  const capped = fetchableItems < totalItems;
  const firstPageCount = Math.min(perPage, totalItems);
  const noResults = totalItems === 0;

  return (
    <div className="estimate-overlay" onClick={onCancel}>
      <div className="estimate-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="estimate-title">Search preview</h2>

        {noResults ? (
          <p className="estimate-empty">
            No listings match these filters. Try broadening your search.
          </p>
        ) : (
          <>
            <div className="estimate-headline">
              <span className="estimate-count">{formatNumber(totalItems)}</span>
              <span className="estimate-count-label">listings found</span>
            </div>

            <div className="estimate-math">
              <div className="estimate-row">
                <span>Fetching everything</span>
                <strong>{formatNumber(fetchableItems)} items · {formatNumber(requestsForAll)} requests</strong>
              </div>
              <div className="estimate-row">
                <span>Estimated time</span>
                <strong>{formatDuration(estimatedTimeMsAll)}</strong>
              </div>
              <div className="estimate-row estimate-rate">
                <span>Safe rate</span>
                <span>{rateDescription}</span>
              </div>
              {capped && (
                <p className="estimate-note">
                  Discogs limits results to {formatNumber(cappedPages)} pages, so up to{' '}
                  {formatNumber(fetchableItems)} of the {formatNumber(totalItems)} can be fetched.
                </p>
              )}
            </div>
          </>
        )}

        <div className="estimate-actions">
          {!noResults && (
            <>
              <button className="estimate-btn estimate-btn-primary" onClick={onFetchAll}>
                Fetch all · {formatNumber(requestsForAll)} req · {formatDuration(estimatedTimeMsAll)}
              </button>
              <button className="estimate-btn estimate-btn-secondary" onClick={onFirstPage}>
                First {formatNumber(firstPageCount)} · instant
              </button>
            </>
          )}
          <button className="estimate-btn estimate-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
