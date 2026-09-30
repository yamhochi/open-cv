import type { Page } from '@open-slide/core';

const muted = '#63635E';
const hair = '#E6E4DF';
const mono = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";

const Title = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: '#21201C' }}>{children}</h2>
);

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

const Continued = () => (
  <div style={{ marginTop: 'auto', textAlign: 'right' }}>
    <span style={{ fontSize: 12, color: muted, fontFamily: mono }}>continued →</span>
  </div>
);

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

const content: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const group: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 20 };

const Fonts = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Geist+Mono:wght@400;500&display=swap');`}</style>
);

const Header = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
    <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>Your Name</span>
    <p style={{ fontSize: 11, lineHeight: 1.4, color: muted, margin: 0, fontFamily: mono, textAlign: 'right' }}>
      you@example.com · +1 555 010 1234 · yoursite.com · in/yourname
    </p>
  </div>
);

const PageOne: Page = () => (
  <div style={page}>
    <Fonts />
    <div style={content}>
      <Header />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <p style={{ fontSize: 12, lineHeight: 1.45, color: muted, margin: 0 }}>
          A short, specific summary of who you are and what you do — the years of experience, the
          domain, and the kind of problems you gravitate toward.
        </p>
        <div style={group}>
          <Title>Relevant experience</Title>
          <div style={group}>
            <Entry date="Jan 2023 – Present" company="Company Name" roleTitle="Your Role Title">
              <Bullet label="Lead with the outcome — what changed, by how much, for whom">
                <SubBullet text="Back it with the mechanism: what you actually did to get there." />
                <SubBullet text="A second supporting detail, if it earns its place." />
              </Bullet>
              <Bullet label="A second result-led bullet, specific and measurable">
                <SubBullet text="How you got there, in one clear line." />
              </Bullet>
            </Entry>
          </div>
        </div>
      </div>
      <Continued />
    </div>
  </div>
);

const PageTwo: Page = () => (
  <div style={page}>
    <Fonts />
    <div style={content}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={group}>
          <Title>Relevant experience (continued)</Title>
          <Entry date="Jun 2020 – Dec 2022" company="Previous Company" roleTitle="Prior Role Title">
            <Bullet
              label="A one-line result"
              body="A longer description when the bullet reads better as a single sentence."
            />
            <Bullet label="A headline result from this role">
              <SubBullet text="The specific action that drove it." />
            </Bullet>
          </Entry>
        </div>
      </div>
      <Footer />
    </div>
  </div>
);

export default [PageOne, PageTwo];
