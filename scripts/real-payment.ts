/**
 * Real end-to-end x402 payment against a deployed RepoPulse Worker on Base
 * mainnet. This is the ONE test that spends real USDC — it is intentionally NOT
 * part of `npm run verify` (which runs fully offline against a mocked
 * facilitator). Run it manually with a funded wallet:
 *
 *   EVM_PRIVATE_KEY=0x... \
 *   API_URL="https://repo-pulse.<subdomain>.workers.dev/v1/health?repo=honojs/hono" \
 *     npx tsx scripts/real-payment.ts
 *
 * Requirements:
 * - A Base-mainnet wallet holding a little USDC (>= $0.01) and ETH for gas.
 * - The Worker deployed with WALLET_ADDRESS + CDP facilitator secrets set.
 *
 * It performs the unpaid request (expect 402), then lets @x402/fetch sign and
 * retry, and prints the health report plus the on-chain settlement tx hash from
 * the PAYMENT-RESPONSE header.
 */
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

async function main(): Promise<void> {
  const key = process.env.EVM_PRIVATE_KEY;
  const url = process.env.API_URL;
  if (!key || !url) {
    throw new Error("Set EVM_PRIVATE_KEY and API_URL environment variables.");
  }

  const account = privateKeyToAccount(key as `0x${string}`);
  console.log(`Paying from ${account.address}`);

  // 1. Show the raw 402 first (no payment) for the record.
  const unpaid = await fetch(url);
  console.log(`Unpaid request → HTTP ${unpaid.status} (expected 402)`);

  // 2. Wrap fetch so it auto-pays on 402 and retries.
  const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });

  const paid = await fetchWithPay(url, { method: "GET" });
  console.log(`Paid request → HTTP ${paid.status}`);

  const body = await paid.json();
  console.log("Health report:", JSON.stringify(body, null, 2));

  const payResp = paid.headers.get("PAYMENT-RESPONSE") ?? paid.headers.get("x-payment-response");
  if (payResp) {
    const decoded = decodePaymentResponseHeader(payResp);
    console.log("Settlement:", JSON.stringify(decoded, null, 2));
    // The transaction hash is your proof of a real settled payment on Base.
  } else {
    console.warn("No PAYMENT-RESPONSE header returned.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
