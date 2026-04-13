export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen">
      <h1
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontWeight: 600,
          fontSize: "32px",
          letterSpacing: "-0.025em",
          color: "#f5f5f5",
          marginBottom: "8px",
        }}
      >
        Pellet
      </h1>
      <p
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "14px",
          color: "#888888",
          letterSpacing: "0.02em",
        }}
      >
        intelligence for Tempo
      </p>
    </main>
  );
}
