export function Footer() {
  return (
    <footer
      style={{
        margin: "0 32px",
        marginTop: "auto",
        borderTop: "none",
        padding: "18px 0",
        textAlign: "center",
        fontSize: 11,
        letterSpacing: "0.04em",
        color: "color-mix(in oklch, var(--fg) 55%, var(--bg))",
      }}
    >
      © {new Date().getFullYear()} Pellet Network
    </footer>
  );
}

export default Footer;
