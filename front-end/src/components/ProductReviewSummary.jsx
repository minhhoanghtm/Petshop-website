import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaStar, FaRegStar } from "react-icons/fa";
import { Link } from "react-router-dom";
import {
  canReviewProduct,
  fetchMyReviews,
  fetchReviewsByProductId,
  seedReviewsFromProduct,
} from "../stores/reviewSlice";
import ReviewButton from "./reviews/ReviewButton";

const convertBase64ToImage = (value) => {
  if (!value) return "/avatar.png";
  if (typeof value !== "string") return "/avatar.png";
  if (value.startsWith("data:image")) return value;
  if (value.startsWith("/") || value.startsWith("http")) return value;
  return `data:image/jpeg;base64,${value}`;
};

const RatingStars = ({ rating = 0 }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: 5 }, (_, index) => index + 1).map((star) =>
      star <= Math.round(Number(rating || 0)) ? (
        <FaStar key={star} className="text-amber-500 text-lg" />
      ) : (
        <FaRegStar key={star} className="text-slate-300 text-lg" />
      ),
    )}
  </div>
);

const formatReviewDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
};

const ProductReviewSummary = ({ product }) => {
  const dispatch = useDispatch();
  const { productId, reviews, summary, canReview, myReviews, loadReviews, checkingCanReview } = useSelector(
    (state) => state.reviews,
  );

  useEffect(() => {
    if (!product?._id) return;

    const hasSeedData = Array.isArray(product?.reviews) && Boolean(product?.reviewSummary);
    const isSameProduct = String(productId || "") === String(product._id);

    if (!isSameProduct) {
      if (hasSeedData) {
        dispatch(seedReviewsFromProduct(product));
      } else {
        dispatch(fetchReviewsByProductId(product._id));
      }
    }

    if (localStorage.getItem("accessToken")) {
      dispatch(canReviewProduct(product._id));
      dispatch(fetchMyReviews());
    }
  }, [dispatch, product?._id, productId]);

  const displayReviews = reviews.length ? reviews : product?.reviews || [];
  const displaySummary = summary.totalReviews ? summary : product?.reviewSummary || summary;

  const currentReview = useMemo(() => {
    if (!product?._id) return null;
    return myReviews.find(
      (review) => String(review.product?._id || review.product) === String(product._id),
    ) || canReview?.review || null;
  }, [canReview?.review, myReviews, product?._id]);

  const reviewOrderId = canReview?.orderId || currentReview?.orderId?._id || currentReview?.orderId || null;
  const reviewLink = product?._id && reviewOrderId ? `/review/${product._id}/${reviewOrderId}` : null;

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-600 font-semibold">Đánh giá sản phẩm</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">{displaySummary.totalReviews || 0} đánh giá từ khách hàng</h3>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-3xl font-bold text-slate-900">{Number(displaySummary.averageRating || 0).toFixed(1)}</span>
                <div>
                  <RatingStars rating={displaySummary.averageRating || 0} />
                  <p className="text-xs text-slate-500">Tổng số đánh giá: {displaySummary.totalReviews || 0}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(canReview?.purchased || currentReview) && (
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  Đã mua hàng
                </span>
              )}
              {canReview?.reviewed ? (
                <ReviewButton to={reviewLink} variant="secondary">
                  Chỉnh sửa đánh giá
                </ReviewButton>
              ) : canReview?.canReview ? (
                <ReviewButton to={reviewLink}>
                  Viết đánh giá
                </ReviewButton>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                  {checkingCanReview ? "Đang kiểm tra..." : canReview?.message || "Bạn cần mua sản phẩm và nhận hàng thành công trước khi đánh giá"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 md:p-6 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-2xl bg-slate-50 p-4 md:p-5">
            <h4 className="text-base font-semibold text-slate-900">Thống kê sao</h4>
            <div className="mt-4 space-y-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = displaySummary.ratingBreakdown?.[star] || 0;
                const max = Math.max(
                  ...Object.values(displaySummary.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
                  1,
                );
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <div className="flex w-16 items-center gap-1 text-slate-600">
                      <span>{star}</span>
                      <FaStar className="text-amber-400" />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-slate-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {loadReviews && !displayReviews.length ? (
              <div className="space-y-3">
                <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            ) : displayReviews.length ? (
              displayReviews.map((review) => (
                <article key={review._id || review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={convertBase64ToImage(review.user?.avatar)}
                        alt={review.user?.fullName || "User"}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-semibold text-slate-900">{review.user?.fullName || "Khách hàng"}</h5>
                          {review.isVerifiedPurchase && (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              Đã mua hàng
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{formatReviewDate(review.createdAt) || " "}</p>
                      </div>
                    </div>

                    {currentReview?._id === (review._id || review.id) && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Đã đánh giá</span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <RatingStars rating={review.rating} />
                    <span className="text-sm font-medium text-slate-700">{review.rating}/5</span>
                  </div>

                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{review.comment}</p>

                  {Array.isArray(review.images) && review.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {review.images.map((image, index) => (
                        <img key={`${review._id || review.id}-${index}`} src={image} alt={`review-${index}`} className="h-20 w-full rounded-xl object-cover" />
                      ))}
                    </div>
                  )}

                  {currentReview?._id === (review._id || review.id) && reviewLink && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <ReviewButton to={reviewLink} variant="secondary">Chỉnh sửa đánh giá</ReviewButton>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Chưa có đánh giá nào cho sản phẩm này.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductReviewSummary;
