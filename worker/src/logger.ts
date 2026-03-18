import pino from "pino";

export const logger = pino({
  name: "product-storyboard-worker",
  level: process.env.LOG_LEVEL ?? "info"
});

