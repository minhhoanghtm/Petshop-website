import { CalendarDays, Mail, Phone } from "lucide-react";
import UserAvatar from "./UserAvatar";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
};

const roleOptions = [
  { value: "user", label: "Khách hàng" },
  { value: "staff", label: "Nhân viên" },
  { value: "admin", label: "Quản trị viên" },
];

const statusOptions = [
  { value: "Active", label: "Hoạt động" },
  { value: "Inactive", label: "Không hoạt động" },
];

const SelectField = ({ value, options, onChange, tone = "amber" }) => {
  const toneStyles =
    tone === "status"
      ? "border-emerald-200 bg-white text-slate-700 focus:ring-emerald-300"
      : "border-amber-200 bg-white text-slate-700 focus:ring-amber-300";

  return (
    <select
      value={value}
      onChange={onChange}
      className={`min-w-28 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm outline-none transition focus:ring-2 ${toneStyles}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

const UserTable = ({ users, onRoleChange, onStatusChange }) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full min-w-275 text-left text-sm">
        <thead className="bg-amber-50/90 text-xs uppercase text-slate-700">
          <tr>
            <th className="px-6 py-4 font-semibold tracking-wide">Người dùng</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Email</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Số điện thoại</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Địa chỉ</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Vai trò</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Trạng thái</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {users.length > 0 ? (
            users.map((user, index) => {
              const roleValue = user.role || "user";
              const statusValue = user.status || "Active";

              return (
                <tr
                  key={user._id}
                  className={`border-b border-amber-100/70 transition-colors duration-200 hover:bg-amber-50/60 ${
                    index % 2 === 0 ? "bg-white" : "bg-amber-50/35"
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={user.avatar} alt={user.fullName} size="md" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">{user.fullName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" />
                      {user.email}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />
                      {user.phone}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{user.address}</td>
                  <td className="px-6 py-4">
                    <SelectField
                      value={roleValue}
                      options={roleOptions}
                      onChange={(e) => onRoleChange?.(user, e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <SelectField
                      value={statusValue}
                      options={statusOptions}
                      onChange={(e) => onStatusChange?.(user, e.target.value)}
                      tone="status"
                    />
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays size={14} className="text-slate-400" />
                      {formatDate(user.createdAt)}
                    </span>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="7" className="py-10 text-center text-gray-500">
                Không tìm thấy người dùng nào
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
