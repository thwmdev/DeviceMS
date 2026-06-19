export const normalizeRole = (role) =>
  (role || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]/g, "")
    .toUpperCase();

export const VALID_ROLES = ["NHANVIEN", "ADMIN", "HR"];

export const getCanonicalStoredRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return VALID_ROLES.includes(normalizedRole) ? normalizedRole : "NHANVIEN";
};

export const isEmployeeRole = (role) => {
  return getCanonicalStoredRole(role) === "NHANVIEN";
};

export const getRoleLabel = (role) => {
  const canonicalRole = getCanonicalStoredRole(role);
  if (canonicalRole === "NHANVIEN") return "NHAN VIEN";

  return canonicalRole;
};

const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  return atob(padded);
};

export const getRoleFromToken = (token) => {
  if (!token) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

export const getRoleFromAuthResponse = (data) =>
  data?.role || getRoleFromToken(data?.token);

export const getStoredRole = () => {
  const storedRole = localStorage.getItem("role");
  if (storedRole && storedRole !== "undefined") return storedRole;

  return getRoleFromToken(localStorage.getItem("token"));
};
