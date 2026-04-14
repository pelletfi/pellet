export type Address = `0x${string}`;
export interface ReproducibilityMeta {
    methodologyVersion: string;
    computedAt: string;
    method?: string;
    sourceBlock?: number;
    sourceCall?: string;
    sourceContracts?: string[];
    sourceTables?: string[];
    freshnessSec?: number;
}
export interface StablecoinSummary {
    address: Address;
    name: string;
    symbol: string;
    currency: string;
    policy_id: number;
    policy_type: string;
    policy_admin: string;
    supply_cap: string;
    current_supply: string;
    headroom_pct: number;
    price_vs_pathusd: number;
    spread_bps: number;
    volume_24h: number;
    yield_rate: number;
    opted_in_supply: string;
    risk?: {
        composite: number;
        components: Record<string, number>;
        computed_at: string;
    } | null;
}
export interface StablecoinsListResponse {
    stablecoins: StablecoinSummary[];
}
export interface PegWindow {
    window: "1h" | "24h" | "7d";
    computed_at: string;
    sample_count: number;
    mean_price: number;
    stddev_price: number;
    min_price: number;
    max_price: number;
    max_deviation_bps: number;
    seconds_outside_10bps: number;
    seconds_outside_50bps: number;
}
export interface PegResponse {
    address: Address;
    current: {
        price_vs_pathusd: number;
        spread_bps: number;
        block_number: number;
        sampled_at: string;
    } | null;
    windows: PegWindow[];
}
export interface PegEvent {
    severity: "mild" | "severe";
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    max_deviation_bps: number;
    started_block: number;
    ended_block: number | null;
    ongoing: boolean;
}
export interface PegEventsResponse {
    address: Address;
    events: PegEvent[];
}
export interface RiskComponents {
    peg_risk: number;
    peg_break_risk: number;
    supply_risk: number;
    policy_risk: number;
}
export interface RiskResponse {
    address: Address;
    composite: number;
    components: RiskComponents;
    computed_at: string;
}
export interface ReserveEntry {
    reserve_type: string;
    backing_usd: number | null;
    attestation_source: string | null;
    attested_at: string | null;
    verified_by: string | null;
    notes: {
        issuer?: string;
        backing_model?: string;
        label?: string;
    } | null;
}
export interface ReservesResponse {
    address: Address;
    total_backing_usd: number | null;
    reserves: ReserveEntry[];
}
export interface RoleHolder {
    holder: Address;
    holder_label: string | null;
    holder_category: string | null;
    holder_notes: unknown;
    granted_at: string | null;
    granted_tx_hash: string | null;
    source: string;
}
export interface RoleEntry {
    role_name: string;
    role_hash: string | null;
    holder_count: number;
    holders: RoleHolder[];
}
export interface RolesResponse {
    address: Address;
    coverage: {
        status: "partial" | "deriving" | "unavailable";
        message: string;
        roles_tracked: {
            name: string;
            powers: string;
        }[];
        derivation?: string;
    };
    roles: RoleEntry[];
}
export interface FlowEdge {
    from_token: string;
    to_token: string;
    net_flow_usd: number;
    tx_count: number;
    hour: string;
}
export interface FlowsResponse {
    flows: FlowEdge[];
}
export interface FlowAnomaly {
    from_token: Address;
    to_token: Address;
    window_start: string;
    window_end: string;
    observed_flow_usd: number;
    baseline_mean_usd: number;
    baseline_stddev_usd: number;
    z_score: number;
    tx_count: number;
    detected_at: string;
}
export interface FlowAnomaliesResponse {
    anomalies: FlowAnomaly[];
}
export interface HealthResponse {
    status: "ok" | "drift" | "fail";
    details: {
        cursor?: {
            last_block: number;
            chain_head: number;
            lag_blocks: number;
        };
        peg_samples?: {
            latest_at: string | null;
            lag_seconds: number | null;
        };
    };
    checked_at: string;
}
export interface CronRun {
    name: string;
    latest_status: "ok" | "error" | null;
    latest_duration_ms: number;
    latest_started_at: string;
    latest_error: string | null;
    runs_24h: number;
    ok_24h: number;
    avg_duration_ms_24h: number | null;
}
export interface CronRunsResponse {
    crons: CronRun[];
}
export interface AddressLabel {
    address: Address;
    label: string;
    category: "system" | "token" | "bridge" | "issuer" | "multisig" | "eoa" | "other";
    source: "pellet_curated" | "forensic" | "ens" | "community";
    notes: unknown;
}
