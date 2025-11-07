/**
 * Progress indicator component
 */

import './ProgressBar.css';
import { ProgressUpdate } from '../types';

interface ProgressBarProps {
  progress: ProgressUpdate | null;
  onCancel: () => void;
}

export function ProgressBar({ progress, onCancel }: ProgressBarProps) {
  if (!progress) return null;

  const percentage = progress.totalPages > 0 
    ? (progress.currentPage / progress.totalPages) * 100 
    : 0;

  return (
    <div className="progress-container">
      <div className="progress-info">
        <span className="progress-text">
          Page {progress.currentPage} of {progress.totalPages}... {progress.itemsLoaded} items loaded
        </span>
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
