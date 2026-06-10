import axiosInstance from "../utils/axiosInstance";

// ================= ADMIN API FUNCTIONS =================

export const createVoucher = (voucherData) => 
  axiosInstance.post("/api/vouchers", voucherData);

export const updateVoucher = (voucherId, voucherData) => 
  axiosInstance.put(`/api/vouchers/${voucherId}`, voucherData);

export const softDeleteVoucher = (voucherId) => 
  axiosInstance.delete(`/api/vouchers/${voucherId}`);

export const toggleVoucherActive = (voucherId, isActive) => 
  axiosInstance.patch(`/api/vouchers/${voucherId}/toggle`, { isActive });

export const fetchVoucherStats = () => 
  axiosInstance.get("/api/vouchers/admin/stats");

export const fetchVoucherHistory = (voucherId, page = 1, limit = 10) => 
  axiosInstance.get(`/api/vouchers/admin/${voucherId}/history?page=${page}&limit=${limit}`);

// ================= USER API FUNCTIONS =================

export const fetchPublicVouchers = () => 
  axiosInstance.get("/api/vouchers/public");

export const claimVoucher = (codeOrId) => 
  axiosInstance.post("/api/vouchers/claim", { code: codeOrId, voucherId: codeOrId });

export const fetchUserWallet = (status = "available") => 
  axiosInstance.get(`/api/vouchers/wallet?status=${status}`);

export const applyVoucher = (payload) => 
  axiosInstance.post("/api/vouchers/apply", payload);
