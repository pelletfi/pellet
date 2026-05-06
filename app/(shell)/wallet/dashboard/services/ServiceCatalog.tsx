"use client";

import { useState } from "react";
import type { MppDirectoryEntry } from "@/lib/mpp/types";

const CATEGORIES = [
  "all",
  "ai",
  "data",
  "blockchain",
  "search",
  "web",
  "media",
  "social",
  "compute",
  "storage",
] as const;

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    ai: "AI",
    blockchain: "CHAIN",
  };
  return labels[cat] || cat.toUpperCase();
}

export function ServiceCatalog({
  services,
}: {
  services: MppDirectoryEntry[];
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? services
      : services.filter((s) => s.categories.includes(filter));

  return (
    <section style={{ paddingBottom: 48 }}>
      <div className="spec-col-head">
        <span className="spec-col-head-left">MPP SERVICES</span>
        <span className="spec-col-head-right">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`spec-filter-btn${filter === cat ? " spec-filter-btn-active" : ""}`}
              onClick={() => setFilter(cat)}
            >
              {cat === "all" ? "ALL" : categoryLabel(cat)}
            </button>
          ))}
        </span>
      </div>

      <div className="spec-services-grid">
        {filtered.map((service) => {
          const primaryCat = service.categories[0] || "other";

          return (
            <div key={service.id} className="spec-service-card">
              <div className="spec-service-card-top">
                <div className="spec-service-card-name">{service.name}</div>
                <span className="spec-service-card-cat">
                  {categoryLabel(primaryCat)}
                </span>
              </div>

              {service.description && (
                <p className="spec-service-card-desc">
                  {service.description.length > 140
                    ? service.description.slice(0, 140) + "…"
                    : service.description}
                </p>
              )}

              <div className="spec-service-card-meta">
                <span className="spec-service-card-meta-label">categories</span>
                <span>{service.categories.join(", ")}</span>

                <span className="spec-service-card-meta-label">payment</span>
                <span>HTTP 402 · Tempo</span>
              </div>

              <a
                className="spec-service-card-link"
                href={service.serviceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {service.serviceUrl.replace(/^https?:\/\//, "")} →
              </a>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            padding: "32px 0",
            opacity: 0.5,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          No services in this category.
        </div>
      )}
    </section>
  );
}
