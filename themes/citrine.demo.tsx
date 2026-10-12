import { type Page, useSlidePageNumber } from '@open-slide/core';

const ink = '#282828';
const surface = '#F8F8EF';
const muted = '#707070';
const hair = 'rgba(40, 40, 40, 0.15)';
const lime = '#EBFF00';
const serif = "'Newsreader', 'Times New Roman', serif";
const sans = "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const mono = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";

const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@1,400&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@600&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@700&display=swap');
  `}</style>
);

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

const Callout = ({ title, body }: { title: string; body: string }) => (
  <div
    style={{
      background: surface,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <Label text={title} />
    <div style={{ fontFamily: sans, fontSize: 13, lineHeight: 1.55, color: ink }}>{body}</div>
  </div>
);

const Quote = ({ text, by }: { text: string; by: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div
      style={{
        fontFamily: serif,
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

const page: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: '#FFFFFF',
  color: ink,
  padding: 56,
  boxSizing: 'border-box',
  fontFamily: sans,
};

const Cover: Page = () => (
  <div style={page}>
    <Fonts />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 220 }}>
      <Label text="Annual report" />
      <CoverTitle lead="A year of steady" mark="progress" />
      <div style={{ fontFamily: sans, fontSize: 16, lineHeight: 1.5, color: ink, maxWidth: 520 }}>
        A short line that says what this report covers and who it is for.
      </div>
    </div>
    <Footer title="Report title" />
  </div>
);

const Findings: Page = () => (
  <div style={page}>
    <Fonts />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Label text="Executive summary" />
      <Heading text="What we found" />
      <div style={{ fontFamily: sans, fontSize: 16, lineHeight: 1.5, color: ink }}>
        Open with the answer. A reader should know the result before they reach the end of this
        paragraph.
      </div>
      <Callout
        title="Key finding"
        body="Lead with the result, in a sentence a busy reader can repeat to someone else."
      />
      <Quote text="A short quotation that earns its place on the page." by="Name, role" />
    </div>
    <Footer title="Report title" />
  </div>
);

export default [Cover, Findings];
