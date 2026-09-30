import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';
import type { CSSProperties } from 'react';

export const design: DesignSystem = {
  palette: { bg: '#ffffff', text: '#0a0a0a', accent: '#2563eb' },
  fonts: {
    display: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  },
  typeScale: { hero: 40, body: 15 },
  radius: 4,
};

const section = { marginTop: 28 };
const heading: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--osd-accent)',
  borderBottom: '1px solid #e5e5e5',
  paddingBottom: 6,
  marginBottom: 14,
};

const ResumePage: Page = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: 'var(--osd-bg)',
      color: 'var(--osd-text)',
      fontFamily: 'var(--osd-font-body)',
      padding: '64px 72px',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ fontSize: 'var(--osd-type-hero)', fontWeight: 700, letterSpacing: '-0.02em' }}>
      Your Name
    </div>
    <div style={{ marginTop: 6, fontSize: 16, color: '#525252' }}>
      Role or headline you're targeting
    </div>
    <div style={{ marginTop: 10, fontSize: 13, color: '#737373' }}>
      your.email@example.com · City, Country · linkedin.com/in/you
    </div>

    <div style={section}>
      <div style={heading}>Experience</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Company Name — Job Title</div>
      <div style={{ fontSize: 13, color: '#737373', marginTop: 2 }}>Jan 2023 — Present</div>
      <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6 }}>
        <li>Lead with the outcome: what changed, by how much, for whom.</li>
        <li>Back it with the mechanism: what you actually did to get there.</li>
      </ul>
    </div>

    <div style={section}>
      <div style={heading}>Education</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Institution — Degree</div>
      <div style={{ fontSize: 13, color: '#737373', marginTop: 2 }}>Graduation year</div>
    </div>

    <div style={section}>
      <div style={heading}>Skills</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>Skill, skill, skill, skill</div>
    </div>
  </div>
);

export const meta: SlideMeta = { title: 'Resume' };
export default [ResumePage] satisfies Page[];
