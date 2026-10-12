---
name: Citrine
description: Editorial and exact for reports — square corners, a serif display face over a plain sans, small mono labels, warm off-white surfaces and one acid-lime highlight.
mode: light
---

# Citrine

Citrine is a report look: a serif for headings, a quiet sans for reading, a bold mono for small labels, and a single lime accent used the way a highlighter is used. Nothing is rounded, and nothing has a shadow.

Reference: the published design tokens of https://www.atticus.tech/au (colours, type scale, radii and spacing), read from the page's own CSS on 2026-10-12. Its typefaces are commercial, so Citrine uses free Google Fonts instead. No text, logo or image from the site is used.

## Palette

| Role     | Value       | Notes                                                              |
| -------- | ----------- | ------------------------------------------------------------------ |
| bg       | `#FFFFFF`   | page background                                                    |
| surface  | `#F8F8EF`   | warm off-white fill for callouts and table headers                 |
| sunken   | `#E6E6D2`   | deeper warm grey, for a second level of fill                       |
| text     | `#282828`   | warm near-black, primary copy and headings                         |
| muted    | `#707070`   | secondary copy, captions, page numbers                             |
| hair     | `#28282826` | 1px rules and table lines (the text colour at 15%)                 |
| accent   | `#EBFF00`   | the lime highlight. Always a background with `text` on it, never text colour on white |
| accent-soft | `#F7FF99` | quieter lime, for a tinted band                                  |
| accent-line | `#C5DC00` | the lime's darker edge, for a 1px outline                        |
| inverse  | `#282828`   | dark band background, with `#F8F8EF` text                          |
| positive | `#E2FFC4` / `#56C018` | tint and ink for a good result                         |
| negative | `#FFCDC4` / `#C5491F` | tint and ink for a bad result                          |

## Typography

- Display font: `'Newsreader', 'Times New Roman', serif` — weight 400, tracking `-0.02em`, line-height 1.1 for the cover title and 1.2 for headings. Never bold. Italic is for quotes. (A close free substitute for the reference's commercial serif.)
- Body font: `'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — weight 400, line-height 1.55. Weight 600 only for emphasis inside a sentence.
- Label font: `'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace` — weight 700, uppercase, tracking `0.035em`, 10.5px. For section labels, table headers, captions and page numbers. Never for body copy.
- Webfont import: one stylesheet per weight, loaded once at module top level per `references/webfonts.md` in `slide-authoring`, because a variable font prints to PDF as a Type 3 font and loses the spaces between words when text is copied:
  - `https://fonts.googleapis.com/css2?family=Newsreader:wght@400&display=swap`
  - `https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,400&display=swap`
  - `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400&display=swap`
  - `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600&display=swap`
  - `https://fonts.googleapis.com/css2?family=Geist+Mono:wght@700&display=swap`
- Type scale for the 794 × 1123 A4 page (this replaces the `slide-authoring` defaults):
  - Cover title: 48px
  - Heading: 28px
  - Subheading: 18px
  - Lede: 16px
  - Body: 13px
  - Table text: 12px
  - Label and caption: 10.5px

## Layout

- Content padding: 56px from the page edges. The footer sits 28px from the bottom edge.
- Single column, left-aligned, 682px wide inside the padding.
- Vertical rhythm: 40px between sections, 12px between paragraphs, 8px between a label and the heading under it, 24px between a heading and its content.
- Corners are square everywhere (radius 0). Depth comes from a `surface` fill, never a shadow.
- Separate things with whitespace first, then a 1px `hair` rule. A coloured border over 1px is not used.
- Use the lime at most once per Page: one highlighted word in a title, or one band, not both.

## Fixed components

These are paste-ready. Text goes in as props, and each editable string sits alone in its own `inline-block` element, so the editor can change one line without touching its neighbours.

```tsx
const ink = '#282828';
const surface = '#F8F8EF';
const muted = '#707070';
const hair = 'rgba(40, 40, 40, 0.15)';
const lime = '#EBFF00';
const serif = "'Newsreader', 'Times New Roman', serif";
const sans = "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const mono = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";
```

### Label

```tsx
const Label = ({ text, color = ink }: { text: string; color?: string }) => (
  <div
    style={{
      display: 'inline-block',
      fontFamily: mono,
      fontWeight: 700,
      fontSize: 10.5,
      letterSpacing: '0.035em',
      textTransform: 'uppercase',
      color,
    }}
  >
    {text}
  </div>
);
```

### Heading

```tsx
const Heading = ({ text }: { text: string }) => (
  <h2
    style={{
      margin: 0,
      fontFamily: serif,
      fontWeight: 400,
      fontSize: 28,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
      color: ink,
    }}
  >
    {text}
  </h2>
);
```

### Cover title with a highlighted word

```tsx
const CoverTitle = ({ lead, mark }: { lead: string; mark?: string }) => (
  <h1
    style={{
      margin: 0,
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: '0.25em',
      fontFamily: serif,
      fontWeight: 400,
      fontSize: 48,
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      color: ink,
    }}
  >
    <div>{lead}</div>
    {mark ? (
      <div style={{ background: `linear-gradient(transparent 58%, ${lime} 58%)` }}>{mark}</div>
    ) : null}
  </h1>
);
```

### Callout

```tsx
const Callout = ({ title, body }: { title: string; body: string }) => (
  <div style={{ background: surface, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Label text={title} />
    <div style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.55, color: ink }}>{body}</div>
  </div>
);
```

### Quote

```tsx
const Quote = ({ text, by }: { text: string; by: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 22, lineHeight: 1.3, letterSpacing: '-0.01em', color: ink }}>
      {text}
    </div>
    <Label text={by} color={muted} />
  </div>
);
```

### Footer

```tsx
import { useSlidePageNumber } from '@open-slide/core';

const Footer = ({ title }: { title: string }) => {
  const { current, total } = useSlidePageNumber();
  return (
    <div
      style={{
        position: 'absolute',
        left: 56,
        right: 56,
        bottom: 28,
        paddingTop: 10,
        borderTop: `1px solid ${hair}`,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 10.5,
        letterSpacing: '0.035em',
        textTransform: 'uppercase',
        color: muted,
      }}
    >
      <div>{title}</div>
      <div>
        {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>
    </div>
  );
};
```

## Motion

- Philosophy: **static**. A report is read, not performed. No page transitions or entrance animations.

## Aesthetic

Editorial and exact: a serif headline over a plain, readable sans, small bold mono labels as signposts, warm off-white panels instead of cards, hairlines instead of boxes, and one lime highlight, used like a highlighter pen. Square corners and no shadows give it a printed, institutional feel. Avoid: rounded corners, shadows, gradients other than the highlight band, bold serif, coloured text on white, more than one lime element per page, emoji.

## Example usage

```tsx
const Summary: Page = () => (
  <div style={{ position: 'relative', width: '100%', height: '100%', background: '#FFFFFF', color: ink, padding: 56, boxSizing: 'border-box', fontFamily: sans }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Label text="Executive summary" />
      <Heading text="What we found" />
      <Callout title="Key finding" body="Lead with the result, in a sentence a busy reader can repeat." />
    </div>
    <Footer title="Report title" />
  </div>
);
```
