import express from "express";
import cors from "cors";

// Initialize Express app
const app = express();

// Middleware configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// Import routes
import productRoutes from "./routes/product/product.routes.js";
import categoryRoutes from "./routes/productCategory/product.Category.routes.js";
import subCategoryRoutes  from "./routes/productCategory/subCategory.routes.js";

// Use routes
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/subcategories", subCategoryRoutes);

// Home route
app.get("/", (req, res) => {
  res.send("Welcome To Pet4Fun API!");
});

export default app;
