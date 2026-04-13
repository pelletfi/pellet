import { tempoClient } from "@/lib/rpc";
import type { StablecoinData, StablecoinFlow } from "@/lib/types";
import { TEMPO_ADDRESSES } from "@/lib/types";
import { parseAbiItem } from "viem";
import { readContract, getBlockNumber, getLogs } from "viem/actions";

// ---------------------------------------------------------------------------
// Seed data — canonical Tempo stablecoins
// ---------------------------------------------------------------------------

export const KNOWN_STABLECOINS: { address: `0x${string}`; name: string; symbol: string }[] = [
  { address: "0x20c0000000000000000000000000000000000000", name: "PathUSD", symbol: "pathUSD" },
  { address: "0x20c000000000000000000000b9537d11c60e8b50", name: "Bridged USDC (Stargate)", symbol: "USDC.e" },
  { address: "0x20c0000000000000000000001621e21f71cf12fb", name: "Bridged EURC (Stargate)", symbol: "EURC.e" },
  { address: "0x20c00000000000000000000014f22ca97301eb73", name: "USDT0", symbol: "USDT0" },
  { address: "0x20c0000000000000000000003554d28269e0f3c2", name: "Frax USD", symbol: "frxUSD" },
  { address: "0x20c0000000000000000000000520792dcccccccc", name: "Cap USD", symbol: "cUSD" },
  { address: "0x20c0000000000000000000008ee4fcff88888888", name: "Staked Cap USD", symbol: "stcUSD" },
  { address: "0x20c0000000000000000000005c0bac7cef389a11", name: "Generic USD", symbol: "GUSD" },
  { address: "0x20c0000000000000000000007f7ba549dd0251b9", name: "Reservoir Stablecoin", symbol: "rUSD" },
  { address: "0x20c000000000000000000000aeed2ec36a54d0e5", name: "Wrapped Savings rUSD", symbol: "wsrUSD" },
  { address: "0x20c0000000000000000000009a4a4b17e0dc6651", name: "AllUnity EUR", symbol: "EURAU" },
  { address: "0x20c000000000000000000000383a23bacb546ab9", name: "Re Protocol reUSD", symbol: "reUSD" },
];

// ---------------------------------------------------------------------------
// ABIs — defined inline since these are Tempo precompiles
// ---------------------------------------------------------------------------

const DEX_ABI = [
  {
    name: "quoteSwapExactAmountIn",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint128" },
    ],
    outputs: [{ name: "amountOut", type: "uint128" }],
  },
] as const;

const TIP20_ABI = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "optedInSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const TIP403_ABI = [
  {
    name: "getPolicy",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "policyId", type: "uint256" },
      { name: "policyType", type: "uint8" },
      { name: "admin", type: "address" },
      { name: "supplyCap", type: "uint256" },
      { name: "paused", type: "bool" },
    ],
  },
] as const;

// Policy type enum: 0 = whitelist, 1 = blacklist, 2 = compound
const POLICY_TYPE_LABELS: Record<number, string> = {
  0: "whitelist",
  1: "blacklist",
  2: "compound",
};

// ---------------------------------------------------------------------------
// getStablecoinMetadata — aggregate data for a single stablecoin
// ---------------------------------------------------------------------------

export async function getStablecoinMetadata(
  address: `0x${string}`,
  name: string,
  symbol: string
): Promise<StablecoinData> {
  const isPathUsd = address.toLowerCase() === TEMPO_ADDRESSES.pathUsd.toLowerCase();

  // For pathUSD, skip DEX and policy calls — it IS the quote currency
  if (isPathUsd) {
    // Still fetch supply data
    const [totalSupplyRaw, decimalsRaw, optedInSupplyRaw] = await Promise.allSettled([
      readContract(tempoClient, {
        address,
        abi: TIP20_ABI,
        functionName: "totalSupply",
      }),
      readContract(tempoClient, {
        address,
        abi: TIP20_ABI,
        functionName: "decimals",
      }),
      readContract(tempoClient, {
        address,
        abi: TIP20_ABI,
        functionName: "optedInSupply",
      }),
    ]);

    const decimals =
      decimalsRaw.status === "fulfilled" ? Number(decimalsRaw.value) : 18;
    const divisor = 10n ** BigInt(decimals);

    const totalSupply =
      totalSupplyRaw.status === "fulfilled"
        ? totalSupplyRaw.value.toString()
        : "0";

    const optedIn =
      optedInSupplyRaw.status === "fulfilled"
        ? optedInSupplyRaw.value.toString()
        : "0";

    // pathUSD has no supply cap — headroom is null, represented as -1 sentinel
    return {
      address,
      name,
      symbol,
      currency: "USD",
      policy_id: 0,
      policy_type: "none",
      policy_admin: TEMPO_ADDRESSES.tip403Registry,
      supply_cap: "0",
      current_supply: totalSupply,
      headroom_pct: -1, // no cap
      price_vs_pathusd: 1,
      spread_bps: 0,
      volume_24h: 0,
      yield_rate: 0,
      opted_in_supply: optedIn,
    };
  }

  // Non-pathUSD stablecoins: run all reads in parallel
  const [
    totalSupplyRes,
    decimalsRes,
    optedInRes,
    policyRes,
    quoteInRes,
    quoteOutRes,
  ] = await Promise.allSettled([
    readContract(tempoClient, {
      address,
      abi: TIP20_ABI,
      functionName: "totalSupply",
    }),
    readContract(tempoClient, {
      address,
      abi: TIP20_ABI,
      functionName: "decimals",
    }),
    readContract(tempoClient, {
      address,
      abi: TIP20_ABI,
      functionName: "optedInSupply",
    }),
    readContract(tempoClient, {
      address: TEMPO_ADDRESSES.tip403Registry,
      abi: TIP403_ABI,
      functionName: "getPolicy",
      args: [address],
    }),
    // Quote: 1 unit of this token → pathUSD (bid)
    readContract(tempoClient, {
      address: TEMPO_ADDRESSES.stablecoinDex,
      abi: DEX_ABI,
      functionName: "quoteSwapExactAmountIn",
      args: [address, TEMPO_ADDRESSES.pathUsd, 1_000_000n as unknown as bigint],
    }),
    // Quote: 1 unit of pathUSD → this token (ask)
    readContract(tempoClient, {
      address: TEMPO_ADDRESSES.stablecoinDex,
      abi: DEX_ABI,
      functionName: "quoteSwapExactAmountIn",
      args: [TEMPO_ADDRESSES.pathUsd, address, 1_000_000n as unknown as bigint],
    }),
  ]);

  // Decimals — default to 6 for stablecoins if unavailable
  const decimals = decimalsRes.status === "fulfilled" ? Number(decimalsRes.value) : 6;
  const oneUnit = 10 ** decimals;
  const oneUnitBig = BigInt(oneUnit);

  // Supply
  const totalSupply =
    totalSupplyRes.status === "fulfilled"
      ? totalSupplyRes.value.toString()
      : "0";

  const optedIn =
    optedInRes.status === "fulfilled" ? optedInRes.value.toString() : "0";

  // Policy
  let policyId = 0;
  let policyType = "unknown";
  let policyAdmin = "";
  let supplyCap = "0";
  let headroomPct: number = -1;

  if (policyRes.status === "fulfilled" && policyRes.value) {
    const [pid, ptype, admin, cap] = policyRes.value as [
      bigint,
      number,
      `0x${string}`,
      bigint,
      boolean
    ];
    policyId = Number(pid);
    policyType = POLICY_TYPE_LABELS[ptype] ?? "unknown";
    policyAdmin = admin;
    supplyCap = cap.toString();

    // Headroom: percentage of supply cap remaining
    if (cap > 0n && totalSupplyRes.status === "fulfilled") {
      const currentBig = totalSupplyRes.value;
      const remaining = cap - currentBig;
      headroomPct =
        remaining <= 0n
          ? 0
          : Number((remaining * 10000n) / cap) / 100;
    }
  }

  // DEX spread: bid = tokenIn→pathUSD output per 1 unit, ask = pathUSD→tokenOut input per 1 unit
  let priceVsPathusd = 1;
  let spreadBps = 0;

  const bidOk = quoteInRes.status === "fulfilled";
  const askOk = quoteOutRes.status === "fulfilled";

  if (bidOk && askOk) {
    // quoteIn: sell 1 unit of stablecoin → get X pathUSD (6 decimals)
    const bidAmount = Number(quoteInRes.value) / 1_000_000; // pathUSD has 6 decimals
    // quoteOut: sell 1_000_000 pathUSD units → get Y stablecoin units
    // price (ask) = 1_000_000 / quoteOut (in stablecoin units) then normalize
    const askUnits = Number(quoteOutRes.value);
    const askPrice = askUnits > 0 ? oneUnit / (askUnits / 1_000_000) : 0;

    // Mid-price approximation: average bid and ask
    priceVsPathusd = bidAmount; // bid is the more intuitive "price per token"

    // Spread in bps: (ask - bid) / mid * 10000
    if (bidAmount > 0 && askPrice > 0) {
      const mid = (bidAmount + askPrice) / 2;
      spreadBps = Math.round(((askPrice - bidAmount) / mid) * 10000);
    }
  } else if (bidOk) {
    priceVsPathusd = Number(quoteInRes.value) / 1_000_000;
  }

  return {
    address,
    name,
    symbol,
    currency: "USD",
    policy_id: policyId,
    policy_type: policyType,
    policy_admin: policyAdmin,
    supply_cap: supplyCap,
    current_supply: totalSupply,
    headroom_pct: headroomPct,
    price_vs_pathusd: priceVsPathusd,
    spread_bps: spreadBps,
    volume_24h: 0, // populated by getStablecoinFlows if needed
    yield_rate: 0, // yield_rate requires external oracle — left as 0 for now
    opted_in_supply: optedIn,
  };
}

// ---------------------------------------------------------------------------
// getAllStablecoins — parallel fetch for all known stablecoins
// ---------------------------------------------------------------------------

export async function getAllStablecoins(): Promise<StablecoinData[]> {
  return Promise.all(
    KNOWN_STABLECOINS.map(({ address, name, symbol }) =>
      getStablecoinMetadata(address, name, symbol).catch((err) => {
        console.error(`[stablecoins] failed to fetch ${symbol}:`, err);
        // Return a minimal fallback so the UI doesn't break on a single failure
        return {
          address,
          name,
          symbol,
          currency: "USD",
          policy_id: 0,
          policy_type: "unknown",
          policy_admin: "",
          supply_cap: "0",
          current_supply: "0",
          headroom_pct: -1,
          price_vs_pathusd: 1,
          spread_bps: 0,
          volume_24h: 0,
          yield_rate: 0,
          opted_in_supply: "0",
        } satisfies StablecoinData;
      })
    )
  );
}

// ---------------------------------------------------------------------------
// getStablecoinFlows — track DEX flows between stablecoins over N hours
// ---------------------------------------------------------------------------

const TRANSFER_ABI_ITEM = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export async function getStablecoinFlows(hours = 24): Promise<StablecoinFlow[]> {
  // Tempo produces ~1 block/sec
  const currentBlock = await getBlockNumber(tempoClient);
  const blocksBack = BigInt(Math.floor(hours * 3600));
  const fromBlock = currentBlock > blocksBack ? currentBlock - blocksBack : 0n;

  // Non-pathUSD stablecoins only — pathUSD flows are counted as counterpart
  const trackedTokens = KNOWN_STABLECOINS.filter(
    (s) => s.address.toLowerCase() !== TEMPO_ADDRESSES.pathUsd.toLowerCase()
  );

  const dexAddress = TEMPO_ADDRESSES.stablecoinDex.toLowerCase() as `0x${string}`;

  // Collect Transfer events where the DEX is either sender or receiver
  // These indicate swaps routed through the enshrined DEX precompile
  const flowMatrix: Record<string, Record<string, { usd: number; txCount: number }>> = {};

  // Initialize the matrix for all token pairs
  for (const tokenA of trackedTokens) {
    for (const tokenB of trackedTokens) {
      if (tokenA.address !== tokenB.address) {
        const key = `${tokenA.address}:${tokenB.address}`;
        flowMatrix[key] = flowMatrix[key] ?? {};
      }
    }
  }

  // Fetch logs in parallel for each non-pathUSD token
  const logResults = await Promise.allSettled(
    trackedTokens.map(async (token) => {
      const logs = await getLogs(tempoClient, {
        address: token.address,
        event: TRANSFER_ABI_ITEM,
        fromBlock,
        toBlock: currentBlock,
      });
      return { token, logs };
    })
  );

  // Process logs — group by hour bucket
  const hourlyFlows: Record<
    string, // "fromToken:toToken:YYYY-MM-DDTHH"
    { usd: number; txCount: number }
  > = {};

  for (const result of logResults) {
    if (result.status !== "fulfilled") continue;
    const { token, logs } = result.value;

    for (const log of logs) {
      const from = (log.args.from as string | undefined)?.toLowerCase() ?? "";
      const to = (log.args.to as string | undefined)?.toLowerCase() ?? "";
      const value = (log.args.value as bigint | undefined) ?? 0n;

      // We only care about transfers that involve the DEX precompile
      const throughDex = from === dexAddress || to === dexAddress;
      if (!throughDex) continue;

      // When DEX sends this token → it's the output token of a swap (someone received it)
      // When DEX receives this token → it's the input token of a swap (someone sold it)
      const isSell = to === dexAddress; // token flows INTO dex
      const isBuy = from === dexAddress; // token flows OUT of dex

      if (!isSell && !isBuy) continue;

      // Approximate USD value: assume ~1 USD per token unit (stablecoins)
      // Use 6 decimals as default for stablecoins
      const usdValue = Number(value) / 1_000_000;

      // Determine hour bucket from block number (approximate: block ~ 1s, so block/3600 = hour)
      const blockNum = log.blockNumber ?? currentBlock;
      const hourIndex = Number(blockNum / 3600n);
      const hourLabel = new Date(hourIndex * 3600 * 1000).toISOString().slice(0, 13);

      // For sells (token → DEX), record as outflow from this token
      // For buys (DEX → token), record as inflow to this token
      // Without matching the counterpart log, we record single-sided flows
      const fromToken = isSell ? token.address : "unknown";
      const toToken = isBuy ? token.address : "unknown";

      const flowKey = `${fromToken}:${toToken}:${hourLabel}`;
      if (!hourlyFlows[flowKey]) {
        hourlyFlows[flowKey] = { usd: 0, txCount: 0 };
      }
      hourlyFlows[flowKey].usd += usdValue;
      hourlyFlows[flowKey].txCount += 1;
    }
  }

  // Convert hourly flows map to StablecoinFlow array
  const flows: StablecoinFlow[] = [];

  for (const [key, data] of Object.entries(hourlyFlows)) {
    const [fromToken, toToken, hour] = key.split(":");
    if (!fromToken || !toToken || !hour) continue;
    if (fromToken === "unknown" && toToken === "unknown") continue;

    flows.push({
      from_token: fromToken,
      to_token: toToken,
      net_flow_usd: data.usd,
      tx_count: data.txCount,
      hour: `${hour}:00:00Z`,
    });
  }

  // Sort by volume descending
  flows.sort((a, b) => b.net_flow_usd - a.net_flow_usd);

  return flows;
}
