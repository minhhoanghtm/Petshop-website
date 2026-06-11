import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUsers, blockUser, unblockUser, updateUserRole } from "../../stores/userAdminSlice";
import { toast } from "react-toastify";
import { HiLockClosed, HiLockOpen, HiUser, HiSearch, HiChevronLeft, HiChevronRight } from "react-icons/hi";

const RoleBadge = ({ role }) => {
  const map = {
    user: "bg-gray-100 text-gray-800",
    staff: "bg-blue-50 text-blue-800",
    admin: "bg-red-50 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${map[role] || map.user} shadow-sm`}> {role} </span>
  );
};

const ShortId = ({ id }) => {
  const value = id ? `#${id.slice(-6).toUpperCase()}` : "#------";
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600 dark:text-slate-300">
      {value}
    </span>
  );
};

const StatusBadge = ({ isBlocked }) => {
  return isBlocked ? (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-rose-50 text-rose-700 shadow-sm">Blocked</span>
  ) : (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-800 shadow-sm">Active</span>
  );
};

const Spinner = () => (
  <div className="flex items-center justify-center">
    <svg className="animate-spin h-6 w-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  </div>
);

const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" /><div className="space-y-2"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" /><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" /></div></div></td>
    <td className="p-4"><div className="h-4 w-56 bg-slate-200 dark:bg-slate-700 rounded" /></td>
    <td className="p-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" /></td>
    <td className="p-4"><div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
    <td className="p-4"><div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" /></td>
    <td className="p-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" /></td>
    <td className="p-4"><div className="h-8 w-36 bg-slate-200 dark:bg-slate-700 rounded" /></td>
  </tr>
);

const UsersPage = () => {
  const dispatch = useDispatch();
  const { users, loading, total, page, totalPages } = useSelector((s) => s.userAdmin || {});
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, role, status]);

  const fetchList = (q = {}) => {
    dispatch(getUsers({ page: currentPage, limit: 10, search: q.search ?? search, role, status: q.status ?? status }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchList({ search });
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${hh}:${mm} ${dd}/${month}/${yyyy}`;
  };

  const handleBlock = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn khóa tài khoản này?")) return;
    const res = await dispatch(blockUser(id));
    if (res.error) return toast.error(res.payload?.message || res.error.message);
    toast.success("Đã khóa tài khoản");
  };

  const handleUnblock = async (id) => {
    if (!window.confirm("Mở khóa tài khoản này?")) return;
    const res = await dispatch(unblockUser(id));
    if (res.error) return toast.error(res.payload?.message || res.error.message);
    toast.success("Đã mở khóa tài khoản");
  };

  const handleChangeRole = async (id) => {
    const newRole = prompt("Nhập role mới (user/staff). Chỉ superadmin có thể gán admin.");
    if (!newRole) return;
    const res = await dispatch(updateUserRole({ id, role: newRole }));
    if (res.error) return toast.error(res.payload?.message || res.error.message);
    toast.success("Đã cập nhật role");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6 text-slate-800 dark:text-slate-100">Quản lý người dùng</h1>

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-96">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-amber-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email"
              aria-label="search"
            />
          </div>

          <select value={role} onChange={(e) => { setRole(e.target.value); setCurrentPage(1); }} className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-amber-300 transition">
            <option value="all">Tất cả vai trò</option>
            <option value="user">Khách hàng</option>
            <option value="staff">Nhân viên</option>
            <option value="admin">Quản trị viên</option>
          </select>

          <select value={status} onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }} className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2 bg-white dark:bg-slate-800 shadow-sm focus:ring-2 focus:ring-amber-300 transition">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          <button type="submit" className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-2xl shadow transition transform hover:-translate-y-0.5">
            Tìm
          </button>
        </form>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-500 dark:text-slate-300">Tổng: <span className="font-semibold text-slate-800 dark:text-slate-100">{total || 0}</span></div>
        </div>
      </div>

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-md overflow-hidden border border-amber-100 dark:border-slate-800">
        <div className="px-6 py-4 bg-linear-to-r from-amber-50 via-white to-yellow-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-amber-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Danh sách người dùng</h2>
            <div className="text-sm text-slate-500 dark:text-slate-300">Trang {currentPage} / {totalPages || 1}</div>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-10">
            <Spinner />
          </div>
        )}

        {/* Table for md+ */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed min-w-245">
            <thead className="bg-amber-50/80 dark:bg-slate-800">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">Người dùng</th>
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">Email</th>
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">SĐT</th>
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">Role</th>
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">Trạng thái</th>
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">Ngày tạo</th>
                <th className="p-4 font-semibold uppercase tracking-wide text-xs text-slate-700 dark:text-slate-200">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                // skeleton rows
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : users && users.length ? (
                users.map((u, idx) => (
                  <tr key={u._id} className={`border-t border-amber-100/70 dark:border-slate-800 transition duration-200 hover:-translate-y-px hover:shadow-sm hover:bg-amber-50/60 dark:hover:bg-slate-800 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-amber-50/40 dark:bg-slate-800'}`}>
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar || "/avatar.png"} alt="avatar" className="h-11 w-11 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-900" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{u.fullName}</div>
                          <ShortId id={u._id} />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top text-sm text-slate-500 dark:text-slate-300">{u.email}</td>
                    <td className="p-4 align-top">{u.phone}</td>
                    <td className="p-4 align-top"><RoleBadge role={u.role} /></td>
                    <td className="p-4 align-top"><StatusBadge isBlocked={u.isBlocked} /></td>
                    <td className="p-4 align-top text-sm text-slate-500 dark:text-slate-400">{formatDate(u.createdAt)}</td>
                    <td className="p-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {u.isBlocked ? (
                          <button onClick={() => handleUnblock(u._id)} className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm text-sm hover:-translate-y-0.5">
                            <HiLockOpen className="w-4 h-4" /> <span>Mở khóa</span>
                          </button>
                        ) : (
                          <button onClick={() => handleBlock(u._id)} className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-sm text-sm hover:-translate-y-0.5">
                            <HiLockClosed className="w-4 h-4" /> <span>Khóa</span>
                          </button>
                        )}

                        <button onClick={() => handleChangeRole(u._id)} className="flex items-center gap-2 px-2.5 py-1.5 bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition shadow-sm border border-slate-200 dark:border-slate-700 text-sm hover:-translate-y-0.5">
                          <HiUser className="w-4 h-4" /> <span>Quyền</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <svg className="h-16 w-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h18M9 3v2m6-2v2M4 9h16v10H4z" /></svg>
                      <div className="text-lg font-medium text-slate-700 dark:text-slate-200">Không có người dùng</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Thử thay đổi bộ lọc hoặc tìm kiếm khác.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* pagination controls */}
      <div className="mt-4 flex items-center justify-end gap-3">
        <button disabled={currentPage <= 1} onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-50 hover:bg-amber-50 dark:hover:bg-slate-800 transition">
          <HiChevronLeft /> Prev
        </button>
        <div className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm font-semibold">{currentPage}</div>
        <button disabled={currentPage >= (totalPages || 1)} onClick={() => { setCurrentPage((p) => p + 1); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-50 hover:bg-amber-50 dark:hover:bg-slate-800 transition">
          Next <HiChevronRight />
        </button>
      </div>

      {/* mobile list view */}
      <div className="mt-6 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse mb-3 p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm" />
          ))
        ) : users && users.length ? (
          users.map((u) => (
            <div key={u._id} className="mb-3 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-amber-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <img src={u.avatar || "/avatar.png"} alt="avatar" className="h-12 w-12 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-900" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{u.fullName}</div>
                  <div className="mt-1"><ShortId id={u._id} /></div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-300 truncate">{u.email}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">{u.phone}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <RoleBadge role={u.role} />
                    <StatusBadge isBlocked={u.isBlocked} />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-lg text-center">
            <div className="text-lg font-medium">Không có người dùng</div>
            <div className="text-sm text-slate-500">Thử thay đổi bộ lọc hoặc tìm kiếm khác.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
