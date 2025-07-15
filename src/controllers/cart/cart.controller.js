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
  const { productId, quantity } = req.body;

  // Validate productId
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product ID"));
  }

  // Validate quantity
  if (
    typeof quantity !== "number" ||
    quantity < 1 ||
    !Number.isInteger(quantity)
  ) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Quantity must be a positive integer"));
  }

  // Find user's cart and populate product details
  const cart = await Cart.findOne({ user_id: req.user._id }).populate(
    "items.product_id"
  );
  if (!cart) {
    return res.status(404).json(new ApiResponse(404, null, "Cart not found"));
  }

  // Find item index
  const itemIndex = cart.items.findIndex((item) =>
    item.product_id._id.equals(productId)
  );

  if (itemIndex === -1) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found in cart"));
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;

  // Save and repopulate to get fresh data
  await cart.save();
  const updatedCart = await Cart.findOne({ user_id: req.user._id }).populate(
    "items.product_id"
  );

  return res.json(
    new ApiResponse(
      200,
      {
        items: updatedCart.items,
        productId,
        quantity,
      },
      "Cart item quantity updated successfully"
    )
  );
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid product ID"));
  }

  const cart = await Cart.findOne({ user_id: req.user._id }).populate(
    "items.product_id"
  );
  if (!cart) {
    return res.status(404).json(new ApiResponse(404, null, "Cart not found"));
  }

  const initialCount = cart.items.length;
  cart.items = cart.items.filter(
    (item) => !item.product_id._id.equals(productId)
  );

  if (cart.items.length === initialCount) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Product not found in cart"));
  }

  await cart.save();

  // Return the updated cart with populated items
  const updatedCart = await Cart.findOne({ user_id: req.user._id }).populate(
    "items.product_id"
  );

  return res.json(
    new ApiResponse(
      200,
      {
        items: updatedCart.items,
      },
      "Item removed from cart"
    )
  );
});

export const clearCart = asyncHandler(async (req, res) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user_id: req.user._id },
      { $set: { items: [] } },
      { new: true }
    ).populate("items.product_id");

    if (!cart) {
      return res.status(404).json(new ApiResponse(404, null, "Cart not found"));
    }

    return res.json(
      new ApiResponse(200, {
        items: cart.items || [], // Ensure empty array if null
        message: "Cart cleared successfully",
      })
    );
  } catch (error) {
    console.error("Error clearing cart:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "Internal server error while clearing cart")
      );
  }
});
