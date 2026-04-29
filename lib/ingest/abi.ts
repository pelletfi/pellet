// ABI fragments Pellet cares about for event ingestion.
// Kept minimal and flat — just the events we index into the `events` table.

export const TIP20_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RoleGranted",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RoleRevoked",
    inputs: [
      { name: "role", type: "bytes32", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "SupplyCapUpdated",
    inputs: [
      { name: "oldCap", type: "uint256", indexed: false },
      { name: "newCap", type: "uint256", indexed: false },
    ],
  },
] as const;

export const TIP403_EVENT_ABI = [
  {
    type: "event",
    name: "PolicyCreated",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "admin", type: "address", indexed: true },
      { name: "policyType", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyUpdated",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "admin", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AddressListed",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "account", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AddressDelisted",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "account", type: "address", indexed: true },
    ],
  },
] as const;
