export default function SortableHeader({ label, sortKey, sortConfig, onSort }) {
  const active = sortConfig.key === sortKey;
  const marker = active ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕";

  return (
    <button
      type="button"
      className={`table-sort-button ${active ? "active" : ""}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Sắp xếp theo ${label}`}
    >
      <span>{label}</span>
      <span aria-hidden="true">{marker}</span>
    </button>
  );
}
