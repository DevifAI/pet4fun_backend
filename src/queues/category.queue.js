import Queue from "bull";
import { redisConfig } from "../config/redisConfig.js";
import { handleCategoryJob } from "./../utils/categoryUtils.js";

export const categoryQueue = new Queue("category-queue", {
  redis: redisConfig,
});

categoryQueue.process(async (job, done) => {
  const { categoryId, mode } = job.data;

  try {
    await handleCategoryJob({ categoryId, mode });
    done();
  } catch (err) {
    console.error("Category Queue Error:", err);
    done(new Error("Category job failed"));
  }
});
