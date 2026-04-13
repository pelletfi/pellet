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
    <main className="page-container">
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        MPP Services
      </h1>

      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-tertiary)",
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
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 8,
              textDecoration: "none",
              display: "block",
              transition: "border-color 0.2s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor =
                "var(--color-border-default)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor =
                "var(--color-border-subtle)")
            }
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: 8,
              }}
            >
              {service.name}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "var(--color-text-secondary)",
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
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 4,
                    color: "var(--color-text-tertiary)",
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
            color: "var(--color-text-quaternary)",
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
