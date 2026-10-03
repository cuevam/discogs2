/**
 * Full-screen loading overlay shown while a background request is in flight
 * (e.g. the estimate probe) so the user gets immediate feedback that something
 * is happening — and can't fire off other actions in the meantime.
 */

import './LoadingOverlay.css';

interface LoadingOverlayProps {
  /** Main line, e.g. "Checking Discogs…". */
  message?: string;
  /** Optional secondary line with more detail. */
  detail?: string;
}

export function LoadingOverlay({
  message = 'Working…',
  detail,
}: LoadingOverlayProps) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="vinyl" aria-hidden="true">
          <div className="vinyl-label" />
        </div>
        <div className="loading-text">
          <span className="loading-message">{message}</span>
          {detail && <span className="loading-detail">{detail}</span>}
        </div>
      </div>
    </div>
  );
}
