import argon2 from "argon2";

async function main() {
  const passphrase = process.argv[2];
  if (!passphrase) {
    console.error("Usage: npm run -w @openclaw/sales-mcp hash-passphrase -- <passphrase>");
    process.exit(1);
  }

  const hash = await argon2.hash(passphrase, { type: argon2.argon2id });
  process.stdout.write(`${hash}\n`);
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
