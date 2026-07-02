import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "better-sqlite3", "pino"],
  allowedDevOrigins: ["185.166.212.91", "localhost", "127.0.0.1"],
};

export default nextConfig;
