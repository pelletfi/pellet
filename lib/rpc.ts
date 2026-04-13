import { createPublicClient, http } from "viem";
import { tempo } from "viem/chains";
import { tempoActions } from "viem/tempo";

const transport = process.env.ALCHEMY_API_KEY
  ? http(`https://tempo-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
  : http(); // falls back to built-in rpc.presto.tempo.xyz

export const tempoClient = createPublicClient({
  chain: tempo,
  transport,
}).extend(tempoActions());
