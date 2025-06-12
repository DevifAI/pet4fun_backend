import redis from "./redis.js";

// config/redisConfig.js
export const redisConfig = {
  port: redis.options.port,
  host: redis.options.host,
};
