import { type DesignSystem, type Page, type SlideMeta, useSlidePageNumber } from '@open-slide/core';
import type { ReactNode } from 'react';

// One stylesheet per weight, not one variable-font request: a variable font prints to PDF as a
// Type 3 font, which loses the spaces between words when the text is copied or parsed.
const FONT_HREFS = [
  'https://fonts.googleapis.com/css2?family=Newsreader:wght@400&display=swap',
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,400&display=swap',
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400&display=swap',
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600&display=swap',
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@700&display=swap',
];
const FONT_LINK_ID = 'osd-webfont-report-template';
if (typeof document !== 'undefined') {
  FONT_HREFS.forEach((href, i) => {
    const id = `${FONT_LINK_ID}-${i}`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  });
}

const serif = "'Newsreader', 'Times New Roman', serif";
const sans = "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const mono = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";

export const design: DesignSystem = {
  palette: {
    bg: '#FFFFFF',
    text: '#282828',
    accent: '#EBFF00',
  },
  fonts: {
    display: serif,
    body: sans,
  },
  typeScale: {
    hero: 48,
    body: 13,
  },
  radius: 0,
};

const ink = 'var(--osd-text)';
const surface = '#F8F8EF';
const muted = '#707070';
const hair = 'rgba(40, 40, 40, 0.15)';

// 56px padding on the sides and top. The extra bottom room keeps content clear of the footer.
const page: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  padding: '56px 56px 96px',
  boxSizing: 'border-box',
  fontFamily: 'var(--osd-font-body)',
};

const column = (gap: number): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
});

// Small bold mono signpost, used above headings, in table headers and in the footer.
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

const Heading = ({ text }: { text: string }) => (
  <h2
    style={{
      margin: 0,
      fontFamily: 'var(--osd-font-display)',
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

const Subheading = ({ text }: { text: string }) => (
  <h3
    style={{
      margin: 0,
      fontFamily: 'var(--osd-font-display)',
      fontWeight: 400,
      fontSize: 18,
      lineHeight: 1.25,
      letterSpacing: '-0.01em',
      color: ink,
    }}
  >
    {text}
  </h3>
);

// The cover title can highlight its last words with the accent colour, as a marker band.
const CoverTitle = ({ lead, mark }: { lead: string; mark?: string }) => (
  <h1
    style={{
      margin: 0,
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: '0.25em',
      fontFamily: 'var(--osd-font-display)',
      fontWeight: 400,
      fontSize: 'var(--osd-size-hero)',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      color: ink,
    }}
  >
    <div>{lead}</div>
    {mark ? (
      <div style={{ background: 'linear-gradient(transparent 58%, var(--osd-accent) 58%)' }}>
        {mark}
      </div>
    ) : null}
  </h1>
);

const Lede = ({ text }: { text: string }) => (
  <div style={{ fontSize: 16, lineHeight: 1.5, color: ink }}>{text}</div>
);

const Body = ({ text }: { text: string }) => (
  <div style={{ fontSize: 'var(--osd-size-body)', lineHeight: 1.55, color: ink }}>{text}</div>
);

const Caption = ({ text }: { text: string }) => <Label text={text} color={muted} />;

const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
    <div style={{ width: 120, flexShrink: 0 }}>
      <Label text={label} color={muted} />
    </div>
    <div style={{ fontSize: 13, lineHeight: 1.55, color: ink }}>{value}</div>
  </div>
);

// Bullets are square, to match the square corners everywhere else. Each line is its own
// component so the editor can change one line without touching its neighbours.
const Bullet = ({ text, children }: { text: string; children?: ReactNode }) => (
  <li style={{ ...column(4), fontSize: 'var(--osd-size-body)', lineHeight: 1.55, color: ink }}>
    <div style={{ display: 'flex', gap: 10 }}>
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 8, width: 4, height: 4, background: ink }}
      />
      <div style={{ display: 'inline-block' }}>{text}</div>
    </div>
    {children}
  </li>
);

const SubBullet = ({ text }: { text: string }) => (
  <div style={{ display: 'flex', gap: 10, color: muted }}>
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        marginTop: 8,
        boxSizing: 'border-box',
        width: 4,
        height: 4,
        border: `1px solid ${muted}`,
      }}
    />
    <div style={{ display: 'inline-block' }}>{text}</div>
  </div>
);

const List = ({ children }: { children: ReactNode }) => (
  <ul style={{ margin: 0, padding: 0, listStyle: 'none', ...column(6) }}>{children}</ul>
);

const Callout = ({ title, body }: { title: string; body: string }) => (
  <div style={{ background: surface, padding: '16px 20px', ...column(8) }}>
    <Label text={title} />
    <div style={{ fontSize: 'var(--osd-size-body)', lineHeight: 1.55, color: ink }}>{body}</div>
  </div>
);

const Quote = ({ text, by }: { text: string; by: string }) => (
  <div style={column(10)}>
    <div
      style={{
        fontFamily: 'var(--osd-font-display)',
        fontStyle: 'italic',
        fontSize: 22,
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
        color: ink,
      }}
    >
      {text}
    </div>
    <Label text={by} color={muted} />
  </div>
);

// A table is a header row and data rows. Every cell is its own editable string.
const TABLE_COLUMNS = '2fr 1fr 1fr 1fr';
const tableRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: TABLE_COLUMNS,
  columnGap: 16,
  alignItems: 'baseline',
  padding: '10px 12px',
  borderBottom: `1px solid ${hair}`,
  fontSize: 12,
  lineHeight: 1.4,
  color: ink,
};

const TableHead = ({ a, b, c, d }: { a: string; b: string; c: string; d: string }) => (
  <div style={{ ...tableRow, background: surface }}>
    <Label text={a} />
    <Label text={b} />
    <Label text={c} />
    <Label text={d} />
  </div>
);

const TableRow = ({ a, b, c, d }: { a: string; b: string; c: string; d: string }) => (
  <div style={tableRow}>
    <div style={{ display: 'inline-block' }}>{a}</div>
    <div style={{ display: 'inline-block' }}>{b}</div>
    <div style={{ display: 'inline-block' }}>{c}</div>
    <div style={{ display: 'inline-block' }}>{d}</div>
  </div>
);

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

const Cover: Page = () => (
  <div style={page}>
    <div style={{ ...column(24), paddingTop: 200 }}>
      <Label text="Report" />
      <CoverTitle lead="A report title that says" mark="what it covers" />
      <div style={{ maxWidth: 520 }}>
        <Lede text="A short line that says what this report is about and who it is for." />
      </div>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 56,
        right: 56,
        bottom: 96,
        borderTop: `1px solid ${hair}`,
        paddingTop: 20,
        ...column(10),
      }}
    >
      <MetaRow label="Prepared for" value="Name of the reader or team" />
      <MetaRow label="Prepared by" value="Your name" />
      <MetaRow label="Date" value="1 January 2027" />
      <MetaRow label="Version" value="1.0" />
    </div>
  </div>
);

const Summary: Page = () => (
  <div style={page}>
    <div style={column(24)}>
      <div style={column(8)}>
        <Label text="Executive summary" />
        <Heading text="Summary of findings" />
      </div>
      <Lede text="Open with the answer. A reader should know the result before they reach the end of this paragraph, and know what you want them to do about it." />
      <Callout
        title="Key finding"
        body="Lead with the result, in a sentence a busy reader can repeat to someone else."
      />
      <div style={column(12)}>
        <Subheading text="Key points" />
        <List>
          <Bullet text="The first point, stated as a result and not as a topic.">
            <SubBullet text="The evidence behind it, in one line." />
            <SubBullet text="A second supporting detail, if it earns its place." />
          </Bullet>
          <Bullet text="The second point.">
            <SubBullet text="What it means for the reader." />
          </Bullet>
          <Bullet text="The third point." />
        </List>
      </div>
      <Body text="A closing paragraph that says what the rest of the report covers and how it is organised, so a reader can jump to the part they need." />
    </div>
    <Footer title="Report title" />
  </div>
);

const Results: Page = () => (
  <div style={page}>
    <div style={column(24)}>
      <div style={column(8)}>
        <Label text="Results" />
        <Heading text="Results and analysis" />
      </div>
      <Body text="Describe what happened and why it matters. Keep one idea to a paragraph, and put the number or the finding in the first sentence." />
      <div style={column(10)}>
        <div>
          <TableHead a="Measure" b="Last year" c="This year" d="Change" />
          <TableRow a="First measure" b="100" c="112" d="+12%" />
          <TableRow a="Second measure" b="48" c="52" d="+8%" />
          <TableRow a="Third measure" b="30" c="27" d="-10%" />
        </div>
        <Caption text="Table 1. A short caption that says what the table shows" />
      </div>
      <Body text="Explain the pattern in the table in a sentence or two, then point to what follows from it." />
      <Quote text="A short quotation that earns its place on the page." by="Name, role" />
      <div style={column(12)}>
        <Subheading text="Next steps" />
        <List>
          <Bullet text="The first action, with who does it and by when." />
          <Bullet text="The second action." />
        </List>
      </div>
    </div>
    <Footer title="Report title" />
  </div>
);

export const meta: SlideMeta = {
  title: 'Report template',
  theme: 'citrine',
  createdAt: '2026-10-12T12:41:28.174Z',
};

export default [Cover, Summary, Results] satisfies Page[];
