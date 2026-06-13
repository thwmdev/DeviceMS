export const getNextSort = (currentSort, key) => {
  if (currentSort.key !== key) {
    return { key, direction: "asc" };
  }
  return {
    key,
    direction: currentSort.direction === "asc" ? "desc" : "asc",
  };
};

const normalizeValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;

  const asNumber = Number(value);
  if (value !== "" && !Number.isNaN(asNumber)) return asNumber;

  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate) && String(value).includes("-")) return asDate;

  return String(value).toLocaleLowerCase("vi-VN");
};

export const sortRows = (rows, sortConfig) => {
  if (!sortConfig.key) return rows;

  const direction = sortConfig.direction === "desc" ? -1 : 1;
  return [...rows].sort((first, second) => {
    const firstValue = normalizeValue(first[sortConfig.key]);
    const secondValue = normalizeValue(second[sortConfig.key]);

    if (firstValue > secondValue) return direction;
    if (firstValue < secondValue) return -direction;
    return 0;
  });
};
