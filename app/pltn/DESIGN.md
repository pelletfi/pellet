# PROSPECTUS

A design philosophy for the $PLTN page.

## The movement

**PROSPECTUS.** The classical financial document as visual idiom. Late-twentieth-century Swiss
modernism applied to securities offering circulars, annual reports, and stock prospectuses —
filtered through Wim Crouwel's modular geometry, Massimo Vignelli's reduction to essential, and
the dignified, untouchable typography of a Christie's auction catalog. The page should feel as
though it could have been typeset by a master at Unimark in 1972 and printed on heavy stock by a
firm that has not changed its house style in fifty years. Information dense, generously breathing,
mathematically precise, and entirely sans ornament.

## Form & space

The grid is the substrate. A single twelve-column structure with a generous outer margin of
clear space — the kind of margin a prospectus reserves for a fingertip and an editor's red pencil.
Nothing pushed to the edge; everything anchored to the grid with the discipline of a master
compositor. Vertical rhythm is fixed: a baseline grid descended from the body type's line-height,
inherited by every cell, every numeral, every rule. Sections are demarcated by horizontal hairlines
of varying weight — a 1px ink rule for primary divisions, a 0.5px for secondary, a dotted 0.5px
for tertiary marginalia. The lines are not decoration. They are punctuation.

## Type & numeral

A single neutral sans-serif carries the entire word stack — system-ui in the browser, the
descendant of Helvetica and Akzidenz-Grotesk in the type-historian's mind. Used flat at three
sizes only: a body of 15px, a section title of 20px in semibold, and a single editorial display at
72px set tight against its tracking. No italic. No serif. JetBrains Mono enters only where it must
— a column of numerals, an address, a ticker — set tabular-aligned at a step smaller than its
neighbors, so the proportional sans always carries the page and the mono is never decoration.
Numerals are the page's truth-tellers; they must align column-perfect.

## Scale, rhythm, ornament

There is no ornament. The page acquires its character from rhythm — the cadence at which
horizontal rules fall, the breath between a section title and its body, the precise cell width
of a numeric column. Color is reduced to two literals (paper, ink) plus two derived greys (a
forty-percent rule weight, a sixty-percent secondary text). No accent. No tint. No gradient. The
chart line is the same ink the body type sets in. The buy panel is bordered by hairline only; its
input is a number on a rule, not a box. Every component is a rule, a numeral, or a body of type
arranged on the grid.

## Composition & hierarchy

The page reads top-to-bottom as a single editorial column with a numeric apparatus running beside
it — a financial document's classical layout. Top: a marque-line of running heads (token symbol,
chain wordmark, page locator). Below: the editorial display headline at 72px, anchored hard left,
with the lede in body sans below at one-half the column width. The price tape is a single
horizontal strip of four mono numerals beneath a hairline, treated like the daily quotations row
in the Financial Times. The chart sits inside its own quiet rectangle, framed only by a top and
bottom hairline. The buy panel is composed as a two-column transaction record: pay column / receive
column, separated by a vertical hairline, totals laid out beneath. The address apparatus at the
foot is a definition list — term left, value mono right — bordered by a single rule above. Page
numbers, registered marks, and dateline are tucked into the margins as a setter would tuck them.

## The ethic

This page is the product of meticulous, master-level execution — the kind that comes only from
deep typographic literacy and hours of refinement. The reader should feel the discipline before
they read a word: that every rule lands on the baseline, every numeral aligns to its decimal,
every column edge respects the grid. The reference is unspoken. Those who recognize the shape of
a 1970s equity offering will feel the room; those who don't will simply experience a page that
reads as deeply correct. Nothing draws attention to itself. The page is the document.

---

## Translation to the /pltn page (compositional decisions)

**Grid.** 12-column, 920px max-width, 64px outer margin desktop / 24px mobile. Column gutter
24px. All content snaps to the column grid, no exceptions.

**Type stack.**
- Body / display: `system-ui, -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif`
- Mono accent: `var(--font-jetbrains-mono), ui-monospace, monospace`
- Three sizes only: 15px body, 20px section title, 72px (clamped 40–72px) display
- Weights: 400 body, 500 section title, 400 display (let size do the work, not weight)
- Letter-spacing: -0.02em on the display, 0 elsewhere
- Mono used ONLY for: prices, FDV, supply, address strings, the marque-line ticker

**Color.** Two literals only.
- `--paper: #e8e6e1` (warm bone, not pure white — like uncoated stock)
- `--ink: #0d0d0d` (near-black, not absolute)
- Mode: dark by default (paper-on-ink)
- Greys: 40% mix for hairline rules, 60% mix for secondary text. Nothing else.

**Rule weights.**
- 1px solid for primary section dividers
- 0.5px solid for inner cell dividers
- 0.5px dotted for tertiary marginalia (chart grid only)
- No gradients, no shadows, no rounded corners

**Composition (top-to-bottom):**
1. **Running head** — a single mono row across the top: `[Pellet mark] PELLET · TEMPO · $PLTN`
   on the left, `[Tempo wordmark, white SVG]` on the right. 1px hairline below. Height ~56px.
2. **Editorial display** — the headline set at 72px, system-ui, anchored hard left.
   "An open wallet for the agentic web." set with line-height 1.0, letter-spacing -0.02em, in two
   lines. The whole block snaps to the leftmost six columns. The right six columns are negative
   space — that's the design statement.
3. **Lede** — body sans at 15px, max 56ch, sitting under the headline by 24px.
4. **Quotations row** — a four-cell horizontal strip in mono: PRICE, FDV, SUPPLY, LIQUIDITY. Each
   cell has a 9px label in uppercase mono with 0.16em tracking, then a 22px mono numeral below.
   Cells separated by vertical hairlines. Top/bottom hairlines. No box around the strip.
5. **Chart** — full-width, 360px tall, framed top/bottom by 1px rules. Internal grid is dotted
   0.5px at 5% opacity. Single line, paper color, step interpolation. Right-axis price labels in
   mono.
6. **Transaction panel** — labeled "ORDER" in 9px mono + 0.16em tracking, with a 1px rule below
   the label. Two-column composition:
   - Left column: "PAY" label, then a large number-on-a-rule input (no box), then "pathUSD" sub-label.
   - Right column: "RECEIVE" label, then auto-quoted PLTN amount, then "PLTN" sub-label.
   - Beneath, a definition list: `IMPACT  ·  ·  5.30%`, `SLIPPAGE  ·  ·  [0.5%] [1.0%] [3.0%]`
   - Action: a hairline-bordered button at full width, 13px mono uppercase 0.16em, hover inverts.
7. **Address apparatus** — a definition list at the foot. `TOKEN`, `PAIR`, `GENESIS` in left
   column at 11px mono caps; address string in right column at 11px mono; copy chip far-right.
   1px rule above. No transparency block, no PLLT disclosure paragraph.
8. **Colophon** — at the very bottom in 10px mono caps, dim: `PELLET · TEMPO · MMXXVI` (or current
   year) and `pellet.network/pltn` aligned to the grid. A single hairline above it. That's the
   page-number gesture.

**Ornament budget = 0.** No icons, no emoji, no badges, no pills. The two SVGs in scope (Pellet
mark, Tempo wordmark) are the only graphical elements on the page. Both render in
`currentColor` so they take the ink/paper color.

**The crucial restraint.** The most important decision is what NOT to include. No transparency
block. No "Self-sovereign by design." headline. No serif italic. No marketing copy. The page is
the document; the document speaks by typography alone.
