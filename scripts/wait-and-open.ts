const PORT = Number(process.env.PORT) || 3000;
const HOME_URL = `http://localhost:${PORT}/`;

async function isServerReady(): Promise<boolean> {
  try {
    const res = await fetch(HOME_URL, { redirect: "manual" });
    return res.ok || res.status === 307 || res.status === 308;
  } catch {
    return false;
  }
}

async function waitForServer(maxAttempts = 90): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await isServerReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function openBrowser(url: string): void {
  const { exec } = require("node:child_process") as typeof import("node:child_process");
  const platform = process.platform;
  const command =
    platform === "darwin" ? `open "${url}"` : platform === "win32" ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(command, (err: Error | null) => {
    if (err) console.error("[dev] no se pudo abrir el navegador:", err.message);
  });
}

async function main() {
  console.log("[dev] esperando al servidor web...");
  const ready = await waitForServer();
  if (!ready) {
    console.warn("[dev] el servidor no respondió a tiempo; abrí manualmente:", HOME_URL);
    return;
  }
  console.log("[dev] abriendo landing:", HOME_URL);
  openBrowser(HOME_URL);
}

main().catch((err) => {
  console.error("[dev] error en wait-and-open:", err);
});
