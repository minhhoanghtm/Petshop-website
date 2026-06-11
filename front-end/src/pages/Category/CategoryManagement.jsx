import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import Sidebar from "../../components/Sidebar";
import TopNavigation from "../../components/TopNavigation";
import CategoryTable from "../../components/CategoryTable";
import Modal from "../../components/Modal";
import CategoryForm from "../../components/CategoryForm";
import DeleteCategoryConfirmationModal from "../../components/DeleteCategoryConfirmationModal";
import { fetchUserById as fetchUserByIdRequest } from "../../services/userService";
import {
    createCategory as createCategoryRequest,
    deleteCategory as deleteCategoryRequest,
    fetchCategories as fetchCategoriesRequest,
    updateCategory as updateCategoryRequest,
} from "../../services/categoryService";

const ITEMS_PER_PAGE = 10;

const CategoryManagement = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const [categories, setCategories] = useState([]);
    const [typeOptions, setTypeOptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const searchTimeoutRef = useRef(null);

    const fetchCurrentUser = async () => {
        try {
            const userLocal = JSON.parse(localStorage.getItem("user"));
            if (!userLocal || !userLocal._id) {
                throw new Error("No user found in localStorage");
            }
            const response = await fetchUserByIdRequest(userLocal._id);
            setCurrentUser(response.data);
        } catch (err) {
            console.error("Failed to fetch current user:", err.response?.data || err.message);
            setCurrentUser({
                fullName: "Admin User",
                email: "admin@example.com",
                avatar: "",
            });
        }
    };

    const loadTypeOptions = async () => {
        try {
            const response = await fetchCategoriesRequest();
            const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
            const types = Array.from(new Set(data.map((item) => item.type).filter(Boolean)));
            setTypeOptions(types);
        } catch (err) {
            console.error("Failed to load category types:", err);
        }
    };

    const fetchCategories = async ({ page, search, type } = {}) => {
        try {
            setIsLoading(true);
            const params = {
                page: page ?? currentPage,
                limit: ITEMS_PER_PAGE,
                search: search ?? searchTerm,
                type: type ?? typeFilter,
            };
            const response = await fetchCategoriesRequest(params);
            const payload = response.data;
            if (Array.isArray(payload)) {
                setCategories(payload);
                setTotal(payload.length);
                setTotalPages(1);
            } else {
                setCategories(payload.data || []);
                setTotal(payload.total || 0);
                setTotalPages(payload.totalPages || 1);
            }
        } catch (err) {
            console.error("Lỗi khi tải danh mục:", err);
            toast.error("Không thể tải danh mục");
            setCategories([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentUser();
        loadTypeOptions();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, typeFilter]);

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            fetchCategories({ page: currentPage, search: searchTerm, type: typeFilter });
        }, 400);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [currentPage, searchTerm, typeFilter]);

    const handleCreate = () => {
        setCurrentCategory(null);
        setIsFormOpen(true);
    };

    const handleEdit = (category) => {
        setCurrentCategory(category);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (category) => {
        setCategoryToDelete(category);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!categoryToDelete) return;
        try {
            await deleteCategoryRequest(categoryToDelete._id);
            toast.success("Đã xóa danh mục");
            setIsDeleteModalOpen(false);
            setCategoryToDelete(null);
            await fetchCategories({ page: currentPage, search: searchTerm, type: typeFilter });
            await loadTypeOptions();
        } catch (err) {
            console.error("Lỗi khi xóa danh mục:", err);
            toast.error(err.response?.data?.message || "Xóa danh mục thất bại");
        }
    };

    const handleFormSubmit = async (formData) => {
        try {
            if (currentCategory) {
                await updateCategoryRequest(currentCategory._id, formData);
                toast.success("Cập nhật danh mục thành công");
            } else {
                await createCategoryRequest(formData);
                toast.success("Thêm danh mục thành công");
            }
            setIsFormOpen(false);
            setCurrentCategory(null);
            await fetchCategories({ page: currentPage, search: searchTerm, type: typeFilter });
            await loadTypeOptions();
        } catch (err) {
            console.error("Lỗi khi lưu danh mục:", err);
            toast.error(err.response?.data?.message || "Không thể lưu danh mục");
        }
    };

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

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return (
        <div className="flex h-screen">
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                currentUser={currentUser}
            />
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <TopNavigation
                    setMobileSidebarOpen={setMobileSidebarOpen}
                    currentUser={currentUser}
                />
                <main className="container mx-auto px-4 py-8 overflow-y-auto">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Quản lý danh mục</h1>
                            <p className="text-sm text-gray-500">Tổng số: {total}</p>
                        </div>
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                setTypeFilter("");
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none cursor-pointer border border-blue-500 rounded-md px-4 py-2"
                        >
                            Đặt lại bộ lọc
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <CategoryTable
                            categories={categories}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            typeFilter={typeFilter}
                            onTypeChange={setTypeFilter}
                            typeOptions={typeOptions}
                            onCreate={handleCreate}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            formatDate={formatDate}
                            startIndex={startIndex}
                        />
                    )}

                    {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm disabled:opacity-50 hover:bg-gray-50 transition"
                            >
                                Prev
                            </button>
                            <div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 shadow-sm font-semibold">
                                {currentPage} / {totalPages}
                            </div>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm disabled:opacity-50 hover:bg-gray-50 transition"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </main>
            </div>

            <Modal
                size="lg"
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={currentCategory ? "Cập nhật danh mục" : "Thêm danh mục"}
            >
                <div className="bg-white p-6 rounded-lg">
                    <CategoryForm
                        category={currentCategory}
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                    />
                </div>
            </Modal>

            <DeleteCategoryConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setCategoryToDelete(null);
                }}
                selectedCategory={categoryToDelete}
                onConfirm={handleDeleteConfirm}
            />
        </div>
    );
};

export default CategoryManagement;
