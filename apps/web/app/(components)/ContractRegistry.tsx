import { explorerAddressUrl } from "@/lib/hl/addresses";

type Row = {
  idx: string;
  name: string;
  addr: string;
  addrShort: string;
  status: string;
};

const ROWS: Row[] = [
  {
    idx: "01",
    name: "Anchor",
    addr: "0x2bfcb081c8c5F98261efcdEC3971D0b1bc7ad943",
    addrShort: "0x2bfcb081…d943",
    status: "Live",
  },
  {
    idx: "02",
    name: "Mesh",
    addr: "0x8cA1f4E2335271f12E5E14Cd8378B558fd14114b",
    addrShort: "0x8cA1f4E2…114b",
    status: "Live",
  },
  {
    idx: "03",
    name: "Cipher",
    addr: "0x7c44Dc7Fb45D723455DB1b69EE08Bd718998e5B4",
    addrShort: "0x7c44Dc7F…e5B4",
    status: "Live",
  },
];

export function ContractRegistry() {
  return (
    <section className="contracts">
      <div className="c-header">
        <h3>Contract registry</h3>
        <div className="c-meta">HyperEVM · Block 33,290,371 · Verified</div>
      </div>
      <table>
        <thead>
          <tr>
            <th className="idx">§</th>
            <th className="name">Registry</th>
            <th className="addr">Address</th>
            <th className="status">Status</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.idx}>
              <td className="idx">{r.idx}</td>
              <td className="name">{r.name}</td>
              <td className="addr">
                <a
                  className="addr-link"
                  href={explorerAddressUrl(r.addr)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on HyperScan"
                >
                  <span className="addr-long">{r.addr}</span>
                  <span className="addr-short">{r.addrShort}</span>
                </a>
              </td>
              <td className="status">
                <span className="pellet-dot" style={{ marginRight: 8 }} />
                {r.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
