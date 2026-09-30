---
name: Lars
description: Quiet, editorial, text-first resume theme — white A4 page, near-black type, no accent color, hierarchy from weight and gray. Matches the resume template's spec exactly.
mode: light
---

# Lars

Values below are lifted from `slides/resume/index.tsx` — the resume template is the source of truth.

## Palette

| Role   | Value     | Notes                                                        |
| ------ | --------- | ------------------------------------------------------------ |
| bg     | `#FFFFFF` | page background                                              |
| text   | `#21201C` | warm near-black, primary copy and titles                     |
| accent | `#21201C` | no separate accent color — hierarchy is weight and gray, not hue |
| muted  | `#63635E` | warm gray: summary, bullets, dates, contact line             |
| hair   | `#E6E4DF` | the single hairline above the footer (use sparingly)         |

## Typography

- Display and body font: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — weight 400 for body, 500 for titles and company / role lines. Never 600 or 700.
- Mono font: `'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace` — weight 400, for dates, the contact line and the "continued →" marker only. Never for prose or headings.
- Webfont import: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Geist+Mono:wght@400;500&display=swap` — load once at module top level per `references/webfonts.md` in `slide-authoring`.
- Letter-spacing: `-0.12px`, set once on the page root and inherited. Never override it per element.
- Type scale (794 × 1123 A4 — this replaces the `slide-authoring` defaults):
  - Name: 14px, weight 500 (the `hero` token)
  - Section title: 14px, weight 500 — same size as the name; hierarchy comes from spacing
  - Body, bullets, entry lines, dates: 12px (the `body` token); bullets line-height 1.5, summary 1.45
  - Contact line in the header: 11px mono

## Layout

- Content padding: 48px from the canvas edges, fixed. If content doesn't fit, move whole entries to the next page — never shrink the padding.
- Content column: max-width 640px, centered, left-aligned, single column.
- Vertical rhythm: 24px between the header, the sections group and the footer; 40px between named sections; 20px between a section title and its content, and between entries; 4px inside an entry (date, company line, bullets) and between bullets.
- Two-column grids (skills, achievements / education): 2 equal columns, 20px gap.
- No cards, no borders, no shadows, no rounded containers. The only rule is the footer's 1px hairline.
- Bullets are components, not paragraphs: `<Bullet label="…">` with nested `<SubBullet text="…" />` children, as below.

## Fixed components

These are paste-ready and copied from the resume template.

### Title (section heading)

```tsx
const Title = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: '#21201C' }}>{children}</h2>
);
```

### Entry, Bullet and SubBullet

An entry is atomic — never split it across a page break. The text in `Bullet` and `SubBullet` sits in a `<div style={{ display: 'inline-block' }}>` (not a `<span>`) with the prop as its only child, so each line stays separately editable in the visual editor.

```tsx
const Entry = ({
  date,
  company,
  roleTitle,
  children,
}: {
  date: string;
  company: string;
  roleTitle: string;
  children: React.ReactNode;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 12, color: muted, fontFamily: mono }}>{date}</span>
    <div style={{ fontSize: 12 }}>
      <span style={{ fontWeight: 500 }}>{company}</span>
      <span style={{ fontWeight: 500 }}> · {roleTitle}</span>
    </div>
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {children}
    </ul>
  </div>
);

const Bullet = ({
  label,
  body,
  children,
}: {
  label: string;
  body?: string;
  children?: React.ReactNode;
}) => (
  <li
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontSize: 12,
      lineHeight: 1.5,
      color: muted,
    }}
  >
    <div style={{ display: 'flex', gap: 6 }}>
      <span
        style={{
          flexShrink: 0,
          marginTop: 7,
          width: 3,
          height: 3,
          borderRadius: '50%',
          background: muted,
        }}
      />
      <div>
        <div style={{ display: 'inline-block', color: muted, fontWeight: 500 }}>{label}</div>
        {body ? <>: {body}</> : null}
      </div>
    </div>
    {children}
  </li>
);

const SubBullet = ({ text }: { text: string }) => (
  <div style={{ display: 'flex', gap: 4, paddingLeft: 9 }}>
    <span aria-hidden="true">-</span>
    <div style={{ display: 'inline-block' }}>{text}</div>
  </div>
);
```

### Footer (contact line)

```tsx
const Footer = () => (
  <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${hair}` }}>
    <p
      style={{
        fontSize: 12,
        lineHeight: 1.4,
        color: muted,
        margin: 0,
        fontFamily: mono,
        textAlign: 'left',
      }}
    >
      you@example.com · +1 555 010 1234 · yoursite.com · in/yourname
    </p>
  </div>
);
```

### Continued marker

Put this at the bottom of a page whose content continues on the next one.

```tsx
const Continued = () => (
  <div style={{ marginTop: 'auto', textAlign: 'right' }}>
    <span style={{ fontSize: 12, color: muted, fontFamily: mono }}>continued →</span>
  </div>
);
```

## Motion

- Philosophy: **static**. No page transitions, no entrance animations — the quiet, editorial feel depends on stillness.

## Aesthetic

Quiet, editorial, text-first — a well-typeset document, not a deck. White page, near-black text, warm gray for everything secondary; no accent color, no cards, no borders, no shadows, no icons. Hierarchy comes from weight (400 vs 500), gray vs black and whitespace, never from size jumps or color. Avoid: gradients, rounded containers, bold type, bright accents, emoji, motion.

## Example usage

```tsx
const page: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#FFFFFF',
  color: '#21201C',
  padding: 48,
  boxSizing: 'border-box',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  letterSpacing: '-0.12px',
};

const Resume: Page = () => (
  <div style={page}>
    <div style={{ maxWidth: 640, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>Your Name</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Title>Relevant experience</Title>
          <Entry date="Jan 2023 – Present" company="Company Name" roleTitle="Your Role Title">
            <Bullet label="Lead with the outcome — what changed, by how much, for whom">
              <SubBullet text="Back it with the mechanism: what you actually did to get there." />
            </Bullet>
          </Entry>
        </div>
      </div>
      <Footer />
    </div>
  </div>
);
```
