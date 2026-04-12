import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WALLETS_PATH = path.join(__dirname, "smart-wallets.json");

function loadWallets() {
  if (!fs.existsSync(WALLETS_PATH)) return { wallets: [] };
  try {
    return JSON.parse(fs.readFileSync(WALLETS_PATH, "utf8"));
  } catch {
    return { wallets: [] };
  }
}

function saveWallets(data) {
  fs.writeFileSync(WALLETS_PATH, JSON.stringify(data, null, 2));
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function addSmartWallet({ name, address, category = "alpha", type = "watch" }) {
  if (!EVM_ADDRESS_RE.test(address)) {
    return { success: false, error: "Invalid EVM wallet address format" };
  }
  const data = loadWallets();
  const existing = data.wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
  if (existing) {
    return { success: false, error: `Already tracked as "${existing.name}"` };
  }
  data.wallets.push({ name, address, category, type, addedAt: new Date().toISOString() });
  saveWallets(data);
  log("smart_wallets", `Added wallet watch: ${name} (${category}, type=${type})`);
  return { success: true, wallet: { name, address, category, type } };
}

export function removeSmartWallet({ address }) {
  const data = loadWallets();
  const wallet = data.wallets.find((w) => w.address.toLowerCase() === String(address).toLowerCase());
  if (!wallet) return { success: false, error: "Wallet not found" };
  data.wallets = data.wallets.filter((w) => w.address.toLowerCase() !== String(address).toLowerCase());
  saveWallets(data);
  log("smart_wallets", `Removed wallet watch: ${wallet.name}`);
  return { success: true, removed: wallet.name };
}

export function listSmartWallets() {
  const { wallets } = loadWallets();
  return { total: wallets.length, wallets, note: "Watchlist only. Legacy pool-level LP inspection has been quarantined from active runtime." };
}

export async function checkSmartWalletsOnPool({ pool_address }) {
  return {
    pool: pool_address,
    tracked_wallets: loadWallets().wallets.length,
    in_pool: [],
    confidence_boost: false,
    signal: "Legacy LP smart-wallet pool inspection has been quarantined from the active Helix runtime.",
    deprecated: true,
  };
}
