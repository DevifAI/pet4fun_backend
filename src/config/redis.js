import Redis from "ioredis";

const redis = new Redis({
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  host: process.env.REDIS_HOST || "127.0.0.1",
});

// redis.on("connect", () => {
//   console.log("✅ Redis connected");
// });

// redis.on("error", (err) => {
//   console.error("❌ Redis connection error:", err);
// });
export default redis;
