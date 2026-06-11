/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";
import { IoIosCloseCircle } from "react-icons/io";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { toast } from "react-toastify";

function DialogProduct({ open, setOpen, product }) {
  if (!open) return null;

  // Tạo mảng images với id duy nhất cho mỗi ảnh
  const imagesWithIds = product.images.map((image, index) => ({
    id: `${product._id}-${index}`, // Tạo id duy nhất bằng product id + index
    url: image
  }));

  const [selectedImage, setSelectedImage] = useState(imagesWithIds[0].url);
  const [selectedImageId, setSelectedImageId] = useState(imagesWithIds[0].id);

  const handleImageClick = (image) => {
    setSelectedImage(image.url);
    setSelectedImageId(image.id);
  };

  const { addToCart } = useCart();
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1);

  const handleClick = () => {
    navigate(`/product/${product.slug}`)
    window.scrollTo(0, 0);
  }

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncrease = () => {
    setQuantity(quantity + 1);
  };

  const handleInputChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      setQuantity(value);
    }
  };

  const handleBuyNow = () => {
      if (!userId) {
        navigate("/login");
        return;
      }

      navigate("/checkout", {
        state: {
          buyNowItems: [{
            product_id: product,
            quantity,
          }],
        },
      });
      window.scrollTo(0, 0);
    };
  
  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?._id || user?.id;
  const handleAddToCart = async () => {
    if (!userId) {
      navigate("/login");
      return;
    }

    const pagePathAtClick = window.location.pathname;
    const result = await addToCart(userId, product._id, quantity);

    if (window.location.pathname !== pagePathAtClick) {
      return;
    }

    if (result.success) {
      setOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="fixed inset-0 flex justify-center items-center z-10000000">
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={() => setOpen(false)}
      ></div>

      <div className="bg-white p-6 rounded-lg shadow-lg w-225 relative z-10">
        <IoIosCloseCircle
          className="size-6 absolute -top-3 -right-3 text-amber-50"
          onClick={() => setOpen(false)}
        />

        <div className="flex gap-5">
          <div className="w-1/2 flex flex-col justify-center items-center gap-6">
            <div className="w-full max-w-125 overflow-hidden rounded-lg shadow-[rgba(0,0,0,0.25)_0px_25px_50px_-12px]">
              <img
                src={selectedImage}
                alt="Selected Product"
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              {imagesWithIds.map((image) => (
                <div
                  key={image.id}
                  className={`size-16 md:size-20 cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    selectedImageId === image.id
                      ? "border-amber-500 scale-110"
                      : "border-transparent hover:border-amber-300"
                  }`}
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${image.id}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="w-1/2 flex flex-col gap-17 justify-center">
            <div className="flex flex-col gap-7">
              <Link
                to={`/product/${product.slug}`}
                className="font-bold text-2xl text-[#333] text-brown-hover transition-colors duration-150"
              >
                {product.name}
              </Link>
              <div className="flex items-center gap-5">
                <h5 className="font-bold text-[25px] text-red-600">
                  {/* {new Intl.NumberFormat('vi-VN').format(quantity * product.price)}đ */}
                  {new Intl.NumberFormat("vi-VN").format(product.price)}đ
                </h5>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-gray-700">Số lượng: </span>
                <div className="flex items-center w-fit bg-white border border-gray-300 rounded-full shadow-sm">
                  <button
                    className="size-10 text-lg font-bold bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleDecrease}
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="px-6 text-lg font-medium">{quantity}</span>
                  <button
                    className="size-10 text-lg font-bold bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition rounded-full"
                    onClick={handleIncrease}
                  >
                    +
                  </button>
                </div>
              </div>
              <span className="opacity-50">
                Thương hiệu: Khác | Tình trạng:{" "}
                {product.stock <= 0 ? "Hết hàng" : "Còn hàng"}
              </span>
            </div>
            <div className="flex flex-col w-full justify-center items-center">
              <button
                onClick={() => handleAddToCart()}
                className="mt-3 mb-2 border-2 border-amber-600 duration-200 transition-colors hover:bg-amber-600 hover:text-white w-75 py-2 rounded-[10px] font-medium cursor-pointer"
              >
                Thêm vào giỏ hàng
              </button>
              <button
                onClick={() => handleBuyNow()}
                className="mt-3 mb-2 bg-[#e17100] text-white border-2 border-[#e17100] duration-200 transition-colors hover:bg-white text-brown-hover w-75 py-2 rounded-[10px] font-medium cursor-pointer"
              >
                Mua ngay
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DialogProduct;