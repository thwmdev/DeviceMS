import React from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20px', gap: '15px' }}>
      <button 
        className="btn-secondary"
        disabled={currentPage === 1} 
        onClick={() => onPageChange(currentPage - 1)}
        style={{ padding: '6px 12px' }}
      >
        Trước
      </button>
      <span style={{ fontSize: '14px', color: 'var(--ink)' }}>
        Trang <strong>{currentPage}</strong> / {totalPages}
      </span>
      <button 
        className="btn-secondary"
        disabled={currentPage === totalPages} 
        onClick={() => onPageChange(currentPage + 1)}
        style={{ padding: '6px 12px' }}
      >
        Sau
      </button>
    </div>
  );
}
