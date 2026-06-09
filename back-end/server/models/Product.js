import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  baseStock: {
    type: Number,
  },
  sold: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
  },
  numReviews: {
    type: Number,
    default: 0,
  },
  images: {
    type: [String], 
    default: [],
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category', 
    required: true,
  },
  slug: {
    type: String,
    unique: true,
  },
  lastEventSequence: {
    type: Number,
    required: false,
  },
}, { collection: 'products' });

productSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "product",
  options: {
    sort: { createdAt: -1 },
  },
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model('Product', productSchema);
export default Product;