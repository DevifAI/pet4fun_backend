import express from "express";
import cors from "cors";

// Initialize Express app
const app = express();

// Middleware configuration
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// Import routes
import userRoutes from "./routes/user/user.routes.js";
import productRoutes from "./routes/product/product.routes.js";
import categoryRoutes from "./routes/productCategory/product.Category.routes.js";
import subCategoryRoutes from "./routes/productCategory/subCategory.routes.js";
import childCategoryRoutes from "./routes/productCategory/childSubCategory.routes.js";
import cartRoutes from "./routes/cart/cart.routes.js";
import orderRoutes from "./routes/order/order.routes.js";
import wishlistRoutes from "./routes/wishlist/wishlist.route.js";
import vetRoutes from "./routes/vet/vet.routes.js";
import clinicRoutes from "./routes/clinic/clinic.routes.js";
import paymentRoutes from "./routes/payment/paymentRoutes.js";

// Use routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/subcategories", subCategoryRoutes);
app.use("/api/v1/childCategories", childCategoryRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/vet-consultations", vetRoutes);
app.use("/api/v1/clinic-appointments", clinicRoutes);

// Home route
app.get("/", (req, res) => {
  res.send("Welcome To Pet4Fun API!");
});

export default app;
