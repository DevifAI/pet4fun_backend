import mongoose from "mongoose";
import Cart from "../../models/cart/cart.model.js";
import Product from "../../models/product/product.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user_id: req.user._id }).populate(
    "items.product_id"
  );
  res.json(new ApiResponse(200, cart || { items: [] }, "Fetched cart"));
});

export const addToCart = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!mongoose.Types.ObjectId.isValid(product_id) || quantity < 1)
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product or quantity"));

  const product = await Product.findById(product_id);
  if (!product)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found"));

  let cart = await Cart.findOne({ user_id: req.user._id });
  if (!cart) {
    cart = await Cart.create({
      user_id: req.user._id,
      items: [{ product_id, quantity }],
    });
  } else {
    const item = cart.items.find((i) => i.product_id.equals(product_id));
    if (item) {
      item.quantity += quantity;
    } else {
      cart.items.push({ product_id, quantity });
    }
    await cart.save();
  }
  res.json(new ApiResponse(200, cart, "Added to cart"));
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!mongoose.Types.ObjectId.isValid(product_id) || quantity < 1)
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product or quantity"));

  const cart = await Cart.findOne({ user_id: req.user._id });
  if (!cart)
    return res.status(404).json(new ApiResponse(404, null, "Cart not found"));

  const item = cart.items.find((i) => i.product_id.equals(product_id));
  if (!item)
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not in cart"));

  item.quantity = quantity;
  await cart.save();
  res.json(new ApiResponse(200, cart, "Cart item updated"));
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(productId))
    return res.status(400).json(new ApiResponse(400, null, "Invalid product"));

  const cart = await Cart.findOne({ user_id: req.user._id });
  if (!cart)
    return res.status(404).json(new ApiResponse(404, null, "Cart not found"));

  cart.items = cart.items.filter((i) => !i.product_id.equals(productId));
  await cart.save();
  res.json(new ApiResponse(200, cart, "Removed from cart"));
});

export const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user_id: req.user._id });
  if (!cart)
    return res.status(404).json(new ApiResponse(404, null, "Cart not found"));

  cart.items = [];
  await cart.save();
  res.json(new ApiResponse(200, cart, "Cart cleared"));
});
