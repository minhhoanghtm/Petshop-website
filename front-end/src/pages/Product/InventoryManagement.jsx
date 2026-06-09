import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import TopNavigation from "../../components/TopNavigation";
import ProductTable from "../../components/ProductTable";
import ProductForm from "../../components/ProductForm";
import Modal from "../../components/Modal";
import { toast } from "react-toastify";
import DeleteProductConfirmationModal from "../../components/DeleteProductConfirmationModal";
import { fetchUserById as fetchUserByIdRequest } from "../../services/userService";
import {
  createProduct as createProductRequest,
  deleteProduct as deleteProductRequest,
  fetchProducts as fetchProductsRequest,
  fetchProductsByCategoryId as fetchProductsByCategoryIdRequest,
  searchProductsByQuery as searchProductsByQueryRequest,
  updateProduct as updateProductRequest,
} from "../../services/productService";
import { fetchCategories as fetchCategoriesRequest } from "../../services/categoryService";

const InventoryManagement = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const searchTimeoutRef = useRef(null);


  const fetchCurrentUser = useCallback(async () => {
    try {
      const userLocal = JSON.parse(localStorage.getItem("user"));
      if (!userLocal || !userLocal._id)
        throw new Error("Lỗi không tìm thấy người dùng.");
      const response = await fetchUserByIdRequest(userLocal._id);
      setCurrentUser(response.data);
    } catch (err) {
      console.error(
        "Lỗi:",
        err.response?.data || err.message
      );
      setCurrentUser({
        fullName: "Admin User",
        email: "admin@example.com",
        avatar: "",
      });
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetchProductsRequest();
      setProducts(response.data);
    } catch (err) {
      console.error("Lỗi:", err);
      toast.error("Lỗi khi tải sản phẩm");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetchCategoriesRequest();
      setCategories(response.data);
    } catch (err) {
      console.error("Lỗi", err);
      toast.error("Lỗi khi tải danh mục sản phẩm");
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    fetchProducts();
    fetchCategories();
  }, [fetchCurrentUser, fetchProducts, fetchCategories]);

  const handleCreate = () => {
    setCurrentProduct(null);
    setIsFormOpen(true);
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (productId) => {
    const product = products.find((p) => p._id === productId);
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirmation = async () => {
    if (!productToDelete) return;

    try {
      await deleteProductRequest(productToDelete._id);
      toast.success("Sản phẩm đã được xóa thành công");
      fetchProducts();
    } catch (err) {
      console.error("Lỗi khi xóa sản phẩm:", err);
      toast.error("Xóa sản phẩm thất bại");
    } finally {
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };


  const handleSubmit = async (productData) => {
    try {
      if (currentProduct) {
        await updateProductRequest(currentProduct._id, productData);
        toast.success("Cập nhật sản phẩm thành công");
      } else {
        // create new product
        await createProductRequest(productData);
        toast.success("Thêm sản phẩm mới thành công");
      }
      setIsFormOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Lỗi khi thêm sản phẩm: ", err);
      toast.error(err.response?.data?.message || "Lỗi khi thêm sản phẩm");
    }
  };

  const handleCategoryCreated = (newCategory) => {
    setCategories((prevCategories) => [...prevCategories, newCategory]);
  };

   const handleSearch = useCallback(
     async (term) => {
       try {
         if (term.trim() === "") {
           fetchProducts();
           return;
         }

         const response = await searchProductsByQueryRequest(term);
         setProducts(response.data);
       } catch (err) {
         console.error("Lỗi khi tìm kiếm sản phẩm:", err);
         if (err.response?.status !== 400) {
           toast.error("Lỗi khi tìm kiếm sản phẩm");
         }
       }
     },
     [fetchProducts]
   );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchTerm);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, handleSearch]);


  const handleFilter = async (categoryId) => {
    if (!categoryId) {
      fetchProducts();
      return;
    }
    try {
      const response = await fetchProductsByCategoryIdRequest(categoryId);
      setProducts(response.data);
    } catch (err) {
      console.error("Failed to filter products:", err);
      toast.error("Failed to filter products");
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedProducts = [...products].sort((a, b) => {
      if (key === "category") {
        const nameA = a.category_id?.name || "";
        const nameB = b.category_id?.name || "";
        if (nameA < nameB) return direction === "asc" ? -1 : 1;
        if (nameA > nameB) return direction === "asc" ? 1 : -1;
        return 0;
      }

      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setProducts(sortedProducts);
  };

  const resetFilters = () => {
    fetchProducts();
    setSortConfig({ key: null, direction: "asc" });
  };

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
          <div className="flex flex-col justify-between items-start mb-6 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Quản lý sản phầm
              </h1>
              <p className="text-sm text-gray-600 mt-1">Tổng số: {products.length}</p>
            </div>
            <button
              onClick={resetFilters}
              className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none cursor-pointer border border-blue-500 rounded-md px-4 py-2 mt-3 md:mt-0"
            >
              Đặt lại bộ lọc
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <ProductTable
              products={products}
              categories={categories}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onCreate={handleCreate}
              onSearch={handleSearch}
              onFilter={handleFilter}
              onSort={handleSort}
            />
          )}
        </main>
      </div>

      <Modal size="xl" isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <h2 className="text-xl font-medium mx-6">
          {currentProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}
        </h2>
        <div className="bg-white p-6 rounded-lg">
          <ProductForm
            product={currentProduct}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
            onCategoryCreated={handleCategoryCreated}
          />
        </div>
      </Modal>
      <DeleteProductConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        selectedProduct={productToDelete}
        onConfirm={handleDeleteConfirmation}
      />
    </div>
  );
};

export default InventoryManagement;