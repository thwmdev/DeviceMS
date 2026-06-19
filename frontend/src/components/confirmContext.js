import { createContext, useContext } from "react";

export const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    return async ({ message } = {}) => window.confirm(message || "Bạn có chắc chắn muốn tiếp tục?");
  }
  return confirm;
};
