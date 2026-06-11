import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../layout/MainLayout";
import { fetchMyReviews, fetchPurchasedProducts } from "../../stores/reviewSlice";
import ReviewModal from "../../components/reviews/ReviewModal";
import ReviewButton from "../../components/reviews/ReviewButton";
import { FaStar, FaRegStar } from "react-icons/fa";

const tabs = [
  { key: "all", label: "Tất cả" },
  { key: "not-reviewed", label: "Chưa đánh giá" },
  { key: "reviewed", label: "Đã đánh giá" },
];

const ratingStars = (rating = 0) =>
  Array.from({ length: 5 }, (_, index) => index + 1).map((star) =>
    star <= Math.round(Number(rating || 0)) ? (
      <FaStar key={star} className="text-amber-500" />
    ) : (
      <FaRegStar key={star} className="text-slate-300" />
    ),
  );

const MyReviews = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { purchasedProducts, myReviews, loadPurchasedProducts, loadMyReviews } = useSelector((state) => state.reviews);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      navigate("/login");
      return;
    }

    dispatch(fetchPurchasedProducts());
    dispatch(fetchMyReviews());
  }, [dispatch, navigate]);

  const products = useMemo(() => {
    return purchasedProducts.map((item) => ({
      ...item,
      productId: String(item.product?._id || item.product),
      reviewed: Boolean(item.review),
      review: item.review || null,
    }));
  }, [purchasedProducts]);

  const filteredProducts = useMemo(() => {
    if (activeTab === "reviewed") return products.filter((item) => item.reviewed);
    if (activeTab === "not-reviewed") return products.filter((item) => !item.reviewed);
    return products;
  }, [activeTab, products]);

  return (
    <MainLayout>
      <section className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-10">
        <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Review của tôi</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Đánh giá và sản phẩm đã mua</h1>
            <p className="mt-2 text-sm text-slate-500">Theo dõi các sản phẩm đã mua, đã đánh giá và chưa đánh giá.</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.key
                    ? "bg-amber-500 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 md:p-6">
            {loadPurchasedProducts || loadMyReviews ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-72 rounded-3xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((item) => {
                  const product = item.product;
                  const review = item.review;
                  return (
                    <article key={`${item.orderId}-${item.productId}`} className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                      <img
                        src={product?.images?.[0] || "/pet.png"}
                        alt={product?.name}
                        className="h-48 w-full object-cover"
                      />
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{product?.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{new Intl.NumberFormat("vi-VN").format(product?.price || 0)}đ</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.reviewed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {item.reviewed ? "Đã đánh giá" : "Chưa đánh giá"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-slate-500">Đơn hàng: #{String(item.orderId)}</p>

                        {review && (
                          <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                            <div className="flex items-center gap-1">{ratingStars(review.rating)}</div>
                            <p className="mt-2 line-clamp-3 text-sm text-slate-700">{review.comment}</p>
                          </div>
                        )}

                        <div className="mt-auto flex flex-wrap gap-2 pt-4">
                          {item.reviewed ? (
                            <>
                              <ReviewButton
                                onClick={() => setSelectedItem(item)}
                                variant="secondary"
                              >
                                Chỉnh sửa đánh giá
                              </ReviewButton>
                              <ReviewButton to={`/product/${product?.slug}`} variant="muted">
                                Xem sản phẩm
                              </ReviewButton>
                            </>
                          ) : (
                            <ReviewButton onClick={() => setSelectedItem(item)}>
                              Viết đánh giá
                            </ReviewButton>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                Chưa có sản phẩm phù hợp với bộ lọc này.
              </div>
            )}
          </div>
        </div>

        {selectedItem && (
          <ReviewModal
            isOpen={Boolean(selectedItem)}
            onClose={() => setSelectedItem(null)}
            product={selectedItem.product}
            orderId={selectedItem.orderId}
            existingReview={selectedItem.review}
            onSuccess={() => {
              setSelectedItem(null);
              dispatch(fetchPurchasedProducts());
              dispatch(fetchMyReviews());
            }}
          />
        )}
      </section>
    </MainLayout>
  );
};

export default MyReviews;