type Service = {
  name: string;
  description: string;
  url: string;
  currencies: string[];
};

const FALLBACK_SERVICES: Service[] = [
  {
    name: "Pellet Deep Briefing",
    description:
      "AI-powered token analysis — safety, compliance, distribution, origin. $0.05 per report.",
    url: "https://pelletfi.com/api/v1/tokens",
    currencies: ["pathUSD"],
  },
];

async function fetchServices(): Promise<Service[]> {
  try {
    const res = await fetch("https://mpp.dev/api/services", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return FALLBACK_SERVICES;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return FALLBACK_SERVICES;
    return data as Service[];
  } catch {
    return FALLBACK_SERVICES;
  }
}

export default async function ServicesPage() {
  const services = await fetchServices();

  return (
    <main className="services-container">
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        MPP Services
      </h1>

      <p
        style={{
          fontSize: 15,
          color: "var(--color-secondary)",
          maxWidth: 560,
          margin: "12px 0 32px",
          lineHeight: 1.5,
        }}
      >
        Payment services built on Tempo&apos;s Micropayment Protocol.
        Machine-payable APIs, agent-ready endpoints.
      </p>

      <div className="services-grid">
        {services.map((service) => (
          <a
            key={service.url}
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: 24,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              textDecoration: "none",
              display: "block",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 8,
              }}
            >
              {service.name}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "var(--color-secondary)",
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              {service.description}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {service.currencies.map((currency) => (
                <span
                  key={currency}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    padding: "2px 8px",
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 4,
                    color: "var(--color-muted)",
                  }}
                >
                  {currency}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      {services.length <= 1 && (
        <p
          style={{
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: 14,
            marginTop: 32,
          }}
        >
          More services coming as the Tempo ecosystem grows.
        </p>
      )}
    </main>
  );
}
