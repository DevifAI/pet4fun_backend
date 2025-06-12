// queues/subCategoryQueue.js
import Queue from "bull";
import { redisConfig } from "../config/redisConfig.js";
import { handleSubCategoryJob } from "../utils/subCategoryUtils.js";

export const subCategoryQueue = new Queue("subcategory-queue", {
  redis: redisConfig,
});

// PROCESS JOBS
subCategoryQueue.process(async (job, done) => {
  try {
    await handleSubCategoryJob(job.data);
    done();
  } catch (err) {
    console.error("SubCategory Queue Error:", err);
    done(new Error("SubCategory operation failed"));
  }
});
