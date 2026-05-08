function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.95 2.23L1.64 7.03c-.84.34-.83.81-.15 1.02l3.16.99 7.33-4.63c.35-.21.67-.1.4.13L5.6 10.7l-.23 3.27c.34 0 .49-.15.68-.34l1.63-1.58 3.38 2.5c.62.34 1.07.17 1.23-.58l2.22-10.47c.22-1-.38-1.46-1.06-1.16l-.5.22z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const socials = [
  { href: "https://github.com/pelletnetwork/pellet", label: "GitHub", Icon: GitHubIcon },
  { href: "https://t.me/pelletnetwork", label: "Telegram", Icon: TelegramIcon },
  { href: "https://x.com/pelletnetwork", label: "X", Icon: XIcon },
];

export function Footer() {
  return (
    <footer className="mx-8 mt-auto py-5">
      <div className="mx-auto flex max-w-[720px] items-center justify-between">
        <div className="flex items-center gap-4">
          {socials.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex items-center text-text-tertiary transition-colors duration-150 hover:text-text-primary"
            >
              <Icon />
            </a>
          ))}
          <a
            href="/mcp-docs"
            className="font-mono text-[11px] tracking-[0.04em] text-text-tertiary transition-colors duration-150 hover:text-text-primary"
          >
            Docs
          </a>
        </div>
        <span className="font-sans text-[11px] text-text-tertiary">
          &copy; {new Date().getFullYear()} Pellet Network
        </span>
      </div>
    </footer>
  );
}

export default Footer;
