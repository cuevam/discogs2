/**
 * Results table component using TanStack Table
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
  Header,
} from '@tanstack/react-table';
import { ListingData } from '../types';
import './ResultsTable.css';

interface ResultsTableProps {
  data: ListingData[];
  onExportCSV: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
}

const columnHelper = createColumnHelper<ListingData>();

interface ColumnMenuProps {
  header: Header<ListingData, unknown>;
  onClose: () => void;
}

function ColumnMenu({ header, onClose }: ColumnMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const currentFilter = header.column.getFilterValue() as any;
  const [filterValue, setFilterValue] = useState(
    typeof currentFilter === 'object' && currentFilter?.value 
      ? currentFilter.value 
      : (currentFilter || '')
  );
  const [filterMode, setFilterMode] = useState<'contains' | 'exact'>(
    typeof currentFilter === 'object' && currentFilter?.mode 
      ? currentFilter.mode 
      : 'contains'
  );

  // Sync state when column filter changes externally
  useEffect(() => {
    if (typeof currentFilter === 'object') {
      setFilterValue(currentFilter.value || '');
      setFilterMode(currentFilter.mode || 'contains');
    } else if (currentFilter) {
      setFilterValue(currentFilter);
      setFilterMode('contains');
    } else {
      setFilterValue('');
      setFilterMode('contains');
    }
  }, [currentFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const canSort = header.column.getCanSort();
  const isSorted = header.column.getIsSorted();
  const canFilter = header.column.getCanFilter();
  const isFiltered = header.column.getIsFiltered();

  const handleFilterChange = (value: string) => {
    setFilterValue(value);
    if (!value) {
      header.column.setFilterValue(undefined);
    } else {
      // Store value and mode as object
      header.column.setFilterValue({ value, mode: filterMode });
    }
  };

  const handleModeChange = (mode: 'contains' | 'exact') => {
    setFilterMode(mode);
    if (filterValue) {
      header.column.setFilterValue({ value: filterValue, mode });
    }
  };

  return (
    <div className="column-menu" ref={menuRef}>
      {canFilter && (
        <>
          <div className="filter-input-container">
            <input
              type="text"
              placeholder="Filter..."
              value={filterValue}
              onChange={(e) => handleFilterChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="filter-input"
            />
            <div className="filter-mode-toggle">
              <label className="filter-mode-option">
                <input
                  type="radio"
                  checked={filterMode === 'contains'}
                  onChange={() => handleModeChange('contains')}
                />
                <span>Contains</span>
              </label>
              <label className="filter-mode-option">
                <input
                  type="radio"
                  checked={filterMode === 'exact'}
                  onChange={() => handleModeChange('exact')}
                />
                <span>Exact match</span>
              </label>
            </div>
          </div>
          {isFiltered && (
            <button
              onClick={() => {
                setFilterValue('');
                header.column.setFilterValue(undefined);
              }}
            >
              ✕ Clear Filter
            </button>
          )}
          <div className="menu-divider" />
        </>
      )}
      {canSort && (
        <>
          <button
            onClick={() => {
              header.column.toggleSorting(false);
              onClose();
            }}
            className={isSorted === 'asc' ? 'active' : ''}
          >
            ↑ Sort Ascending
          </button>
          <button
            onClick={() => {
              header.column.toggleSorting(true);
              onClose();
            }}
            className={isSorted === 'desc' ? 'active' : ''}
          >
            ↓ Sort Descending
          </button>
          {isSorted && (
            <button
              onClick={() => {
                header.column.clearSorting();
                onClose();
              }}
            >
              ✕ Clear Sort
            </button>
          )}
          <div className="menu-divider" />
        </>
      )}
      <button
        onClick={() => {
          header.column.toggleVisibility(false);
          onClose();
        }}
      >
        👁️ Hide Column
      </button>
    </div>
  );
}

export function ResultsTable({ data, onExportCSV, showSidebar, onToggleSidebar }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    seller_name: false,
    seller_score: false,
    year: false,
    decade: false,
    condition_media: false,
    condition_sleeve: false,
    listed_at: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showColumnPanel, setShowColumnPanel] = useState(false);

  // Custom filter function that handles both 'contains' and 'exact' modes
  const customFilterFn = (row: any, columnId: string, filterValue: any) => {
    if (!filterValue) return true;
    
    const cellValue = row.getValue(columnId);
    
    // Handle object with mode
    if (typeof filterValue === 'object' && filterValue.value) {
      // If cell is null, exclude it
      if (cellValue == null) return false;
      
      const cellStr = String(cellValue).toLowerCase();
      const searchStr = String(filterValue.value).toLowerCase();
      
      if (filterValue.mode === 'exact') {
        return cellStr === searchStr;
      }
      return cellStr.includes(searchStr);
    }
    
    // Fallback for simple string filters
    if (cellValue == null) return false;
    const cellStr = String(cellValue).toLowerCase();
    const searchStr = String(filterValue).toLowerCase();
    return cellStr.includes(searchStr);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('image_url', {
        header: 'Image',
        size: 80,
        enableColumnFilter: false,
        cell: (info) => (
          <a 
            href={info.row.original.listing_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="image-link"
          >
            <img 
              src={info.getValue()} 
              alt={info.row.original.title}
              className="thumbnail"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect width="60" height="60" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
              }}
            />
          </a>
        ),
        enableSorting: false,
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        size: 250,
        filterFn: customFilterFn,
        cell: (info) => (
          <a 
            href={info.row.original.listing_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="title-link"
          >
            {info.getValue()}
          </a>
        ),
      }),
      columnHelper.accessor('artists', {
        header: 'Artists',
        size: 180,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('formats', {
        header: 'Format',
        size: 120,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('price', {
        header: 'Price',
        size: 80,
        cell: (info) => {
          const value = info.getValue();
          return value !== null ? value.toFixed(2) : '-';
        },
      }),
      columnHelper.accessor('shipping', {
        header: 'Shipping',
        size: 80,
        cell: (info) => {
          const value = info.getValue();
          return value !== null ? value.toFixed(2) : '-';
        },
      }),
      columnHelper.accessor('total', {
        header: 'Total',
        size: 80,
        cell: (info) => {
          const value = info.getValue();
          if (value === null || value === undefined) return '-';
          const num = typeof value === 'number' ? value : parseFloat(value);
          return !isNaN(num) ? num.toFixed(2) : '-';
        },
      }),
      columnHelper.accessor('currency', {
        header: 'Currency',
        size: 80,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('have', {
        header: 'Have',
        size: 70,
      }),
      columnHelper.accessor('want', {
        header: 'Want',
        size: 70,
      }),
      columnHelper.accessor('seller_name', {
        header: 'Seller',
        size: 150,
        filterFn: customFilterFn,
        cell: (info) => (
          <a 
            href={info.row.original.seller_url} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            {info.getValue()}
          </a>
        ),
      }),
      columnHelper.accessor('seller_score', {
        header: 'Score',
        size: 70,
        cell: (info) => {
          const value = info.getValue();
          if (value === null || value === undefined) return '-';
          const num = typeof value === 'number' ? value : parseFloat(value);
          return !isNaN(num) ? num.toFixed(1) : '-';
        },
      }),
      columnHelper.accessor('seller_country_name', {
        header: 'Ships From',
        size: 120,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('year', {
        header: 'Year',
        size: 70,
        filterFn: customFilterFn,
        cell: (info) => info.getValue() ?? '-',
      }),
      columnHelper.accessor('decade', {
        header: 'Decade',
        size: 80,
        filterFn: customFilterFn,
        cell: (info) => info.getValue() ?? '-',
      }),
      columnHelper.accessor('condition_media', {
        header: 'Media Condition',
        size: 130,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('condition_sleeve', {
        header: 'Sleeve Condition',
        size: 140,
        filterFn: customFilterFn,
        cell: (info) => info.getValue() ?? '-',
      }),
      columnHelper.accessor('labels', {
        header: 'Labels',
        size: 150,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('catalog_numbers', {
        header: 'Cat#',
        size: 100,
        filterFn: customFilterFn,
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        size: 250,
        filterFn: customFilterFn,
        cell: (info) => (
          <div className="description-cell" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('listed_at', {
        header: 'Listed At',
        size: 110,
        cell: (info) => {
          const value = info.getValue();
          if (!value) return '-';
          return new Date(value).toLocaleDateString();
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
      custom: customFilterFn,
    },
    globalFilterFn: customFilterFn,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  });

  return (
    <div className="results-container">
      <div className="table-controls">
        <button 
          onClick={onToggleSidebar} 
          className="sidebar-toggle-button"
          title={showSidebar ? 'Hide filters' : 'Show filters'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {showSidebar ? (
              <path d="M15 18l-6-6 6-6" />
            ) : (
              <path d="M9 18l6-6-6-6" />
            )}
          </svg>
        </button>
        <div className="table-controls-right">
          <button 
            onClick={() => setShowColumnPanel(!showColumnPanel)} 
            className="column-panel-button-icon"
            title={`Toggle columns (${table.getVisibleLeafColumns().length}/${table.getAllLeafColumns().length} visible)`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
            </svg>
          </button>
          <button 
            onClick={onExportCSV} 
            className="export-button-icon" 
            disabled={data.length === 0}
            title={`Export ${data.length} rows to CSV`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {showColumnPanel && (
        <div className="column-panel">
          <div className="column-panel-header">
            <h3>Show/Hide Columns</h3>
            <button onClick={() => setShowColumnPanel(false)} className="close-panel">✕</button>
          </div>
          <div className="column-panel-content">
            {table.getAllLeafColumns().map((column) => (
              <label key={column.id} className="column-panel-item">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  className="column-toggle"
                />
                <span className="toggle-switch"></span>
                <span className="column-label">
                  {typeof column.columnDef.header === 'string' 
                    ? column.columnDef.header 
                    : column.id.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="results-table" style={{ width: table.getCenterTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th 
                    key={header.id}
                    style={{ width: header.getSize(), position: 'relative' }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="header-cell">
                        <div
                          className={
                            header.column.getCanSort()
                              ? 'sortable-header'
                              : 'header-content'
                          }
                          onClick={() => {
                            if (activeMenu === header.id) {
                              setActiveMenu(null);
                            } else {
                              setActiveMenu(header.id);
                            }
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() && (
                            <span className="sort-indicator">
                              {header.column.getIsSorted() === 'asc' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="18 15 12 9 6 15" />
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              )}
                            </span>
                          )}
                          <span className="menu-icon">⋮</span>
                        </div>
                        {activeMenu === header.id && (
                          <ColumnMenu
                            header={header}
                            onClose={() => setActiveMenu(null)}
                          />
                        )}
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`resizer ${
                            header.column.getIsResizing() ? 'isResizing' : ''
                          }`}
                        />
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td 
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className={cell.column.id === 'image_url' ? 'image-cell' : ''}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="empty-state">
            <p>No results yet. Use the filters to start a search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
