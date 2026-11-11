#!/usr/bin/env node
/**
 * Sets the Convex environment variables that sign-in needs, without printing secrets:
 * JWT_PRIVATE_KEY and JWKS (a fresh key pair), SITE_URL and ADMIN_EMAILS.
 * The Google client id and secret are set separately (see README).
 *
 *   node scripts/setup-auth.mjs http://localhost:3000 you@gmail.com
 *   node scripts/setup-auth.mjs https://your-site.vercel.app you@gmail.com --prod
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const [siteUrl, adminEmails, ...extraArgs] = process.argv.slice(2);
if (!siteUrl || !adminEmails) {
  console.error("Bruk: node scripts/setup-auth.mjs <site-url> <admin-epost[,flere]> [--prod]");
  process.exit(1);
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function setEnv(name, value) {
  execFileSync("npx", ["convex", "env", "set", ...extraArgs, name, "--", value], {
    cwd,
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(`✔ ${name}`);
}

setEnv("JWT_PRIVATE_KEY", privateKey.trimEnd().replace(/\n/g, " "));
setEnv("JWKS", jwks);
setEnv("SITE_URL", siteUrl.replace(/\/$/, ""));
setEnv("ADMIN_EMAILS", adminEmails);
