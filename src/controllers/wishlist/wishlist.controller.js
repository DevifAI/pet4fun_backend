import mongoose from "mongoose";
import Product from "../../models/product/product.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Wishlist } from "../../models/Wishlist/wishlist.model.js";

export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user_id: req.user._id })
    .populate("products")
    .exec();

  res.json(
    new ApiResponse(
      200,
      wishlist || { products: [] },
      "Wishlist fetched successfully"
    )
  );
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const { product_id } = req.body;

  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product ID"));
  }

  const product = await Product.findById(product_id);
  if (!product) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found"));
  }

  let wishlist = await Wishlist.findOne({ user_id: req.user._id });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user_id: req.user._id,
      products: [product_id],
    });
  } else {
    // Check if product already exists in wishlist
    if (wishlist.products.some((p) => p.equals(product_id))) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Product already in wishlist"));
    }

    wishlist.products.push(product_id);
    await wishlist.save();
  }

  const populatedWishlist = await Wishlist.findById(wishlist._id)
    .populate("products")
    .exec();

  res.json(
    new ApiResponse(
      200,
      populatedWishlist,
      "Product added to wishlist successfully"
    )
  );
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product ID"));
  }

  const wishlist = await Wishlist.findOne({ user_id: req.user._id });
  if (!wishlist) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Wishlist not found"));
  }

  const initialCount = wishlist.products.length;
  wishlist.products = wishlist.products.filter(
    (product) => !product.equals(productId)
  );

  if (wishlist.products.length === initialCount) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found in wishlist"));
  }

  await wishlist.save();

  const populatedWishlist = await Wishlist.findById(wishlist._id)
    .populate("products")
    .exec();

  res.json(
    new ApiResponse(
      200,
      populatedWishlist,
      "Product removed from wishlist successfully"
    )
  );
});

export const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user_id: req.user._id },
    { $set: { products: [] } },
    { new: true }
  ).populate("products");

  if (!wishlist) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Wishlist not found"));
  }

  res.json(
    new ApiResponse(
      200,
      { products: wishlist.products || [] },
      "Wishlist cleared successfully"
    )
  );
});

export const checkProductInWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product ID"));
  }

  const wishlist = await Wishlist.findOne({
    user_id: req.user._id,
    products: productId,
  });

  res.json(
    new ApiResponse(
      200,
      { isInWishlist: !!wishlist },
      "Product wishlist status checked"
    )
  );
});
