const path = require("node:path");

const root = __dirname;
const tsxBin = path.join(root, "node_modules", ".bin", "tsx");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

/** @type {import("pm2").StartOptions[]} */
const apps = [
  {
    name: "whats-claude-bot",
    script: tsxBin,
    args: "scripts/start-bot.ts",
    cwd: root,
    autorestart: true,
    max_restarts: 20,
    min_uptime: "10s",
    restart_delay: 5000,
    exp_backoff_restart_delay: 200,
    max_memory_restart: "512M",
    env: {
      NODE_ENV: "production",
    },
  },
  {
    name: "whats-claude-web",
    script: nextBin,
    args: "start",
    cwd: root,
    autorestart: true,
    max_restarts: 20,
    min_uptime: "10s",
    restart_delay: 3000,
    exp_backoff_restart_delay: 200,
    max_memory_restart: "768M",
    env: {
      NODE_ENV: "production",
      PORT: process.env.PORT || "3000",
    },
  },
];

module.exports = { apps };
