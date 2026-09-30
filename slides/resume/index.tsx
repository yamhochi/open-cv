import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';
import type { ReactNode } from 'react';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Geist+Mono:wght@400;500&display=swap';
const FONT_LINK_ID = 'osd-webfont-resume-template';
if (typeof document !== 'undefined') {
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== FONT_HREF) link.href = FONT_HREF;
}

export const design: DesignSystem = {
  palette: {
    bg: '#FFFFFF',
    text: '#21201C',
    accent: '#21201C',
  },
  fonts: {
    display: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  typeScale: {
    hero: 14,
    body: 12,
  },
  radius: 0,
};

const muted = '#63635E';
const hair = '#E6E4DF';
const mono = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace";

// Fixed per slide-authoring's global default: 48px padding ("Y position"), never
// shrunk to fit content — overflow becomes a new page instead (see Pagination).
// letterSpacing is set once here and inherits everywhere — never override it per element.
const page: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  padding: 48,
  boxSizing: 'border-box',
  fontFamily: 'var(--osd-font-body)',
  letterSpacing: '-0.12px',
};

// Fixed content max-width, centered within the padded area. This gap is for chrome-adjacent
// spacing (Header -> sections group, sections group -> Continued/footer) — not the
// between-sections gap itself, which is SECTION_GAP below.
const content: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

// Between named sections (Summary, Core Skills, Relevant Experience, Education, ...): 40px.
const SECTION_GAP = 40;
const sections: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SECTION_GAP,
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2
    style={{
      fontSize: 14,
      fontWeight: 500,
      margin: 0,
      color: 'var(--osd-text)',
    }}
  >
    {children}
  </h2>
);

// Single source of truth for contact details, so every placement (header, footer,
// cover letter) stays in sync instead of drifting into different phone formats/orders.
const CONTACT = {
  email: 'you@example.com',
  phone: '+1 555 010 1234',
  website: 'yoursite.com',
  linkedin: 'in/yourname',
} as const;

// Only fields that should render as clickable links carry an href — email/phone stay
// plain text on the page (no mailto:/tel: requested), website/linkedin open the profile.
const CONTACT_LINKS: Partial<Record<keyof typeof CONTACT, string>> = {
  website: 'https://yoursite.com',
  linkedin: 'https://www.linkedin.com/in/yourname',
};

// fontSize defaults to 12 (the document rule); the header's contact line is a deliberate
// exception at 11px so the full line fits without wrapping — not a general precedent.
const ContactMeta = ({
  fields = ['email', 'phone', 'website', 'linkedin'],
  align,
  fontSize = 12,
}: {
  fields?: (keyof typeof CONTACT)[];
  align?: 'left' | 'right';
  fontSize?: number;
}) => (
  <p
    style={{
      fontSize: fontSize,
      lineHeight: 1.4,
      color: muted,
      margin: 0,
      fontFamily: mono,
      textAlign: align ?? 'left',
    }}
  >
    {fields.map((f, i) => {
      const href = CONTACT_LINKS[f];
      return (
        <span key={f}>
          {i > 0 ? ' · ' : ''}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {CONTACT[f]}
            </a>
          ) : (
            CONTACT[f]
          )}
        </span>
      );
    })}
  </p>
);

// Wraps name+role only when a role is actually rendered — no redundant container otherwise.
const Header = ({ role }: { role?: string }) => {
  const name = (
    <span
      style={{
        fontSize: 'var(--osd-size-hero)',
        fontWeight: 500,
        letterSpacing: '-0.12px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      Your Name
    </span>
  );
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}
    >
      {role ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {name}
          <span style={{ fontSize: 12, fontWeight: 500, color: muted }}>{role}</span>
        </div>
      ) : (
        name
      )}
      <ContactMeta align="right" fontSize={11} />
    </div>
  );
};

// Default single-column entry: date line -> Company · Role line -> bold-label bullets.
// See slide-authoring's "Document layout patterns" for why (no rail, no separate paragraph).
// Fixed spacing per that skill: 4px within an entry's own elements, line-height 1.5 for
// bullets. Between-role gap (20px) and between-section gap (40px) are set by the caller.
// Pagination rule: this whole component is atomic — never split across a page break.
// Bullets/sub-bullets are literal <Bullet>/<SubBullet text="…" /> children, not a data array + map —
// each line needs its own JSX node so the inspector can resolve and edit it individually
// instead of falling back to the nearest shared ancestor.
const Entry = ({
  date,
  company,
  roleTitle,
  children,
}: {
  date: string;
  company: string;
  roleTitle: string;
  children: ReactNode;
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
  emphasis,
  children,
}: {
  label: string;
  body?: string;
  emphasis?: boolean;
  children?: ReactNode;
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
      <div style={emphasis ? { fontWeight: 500 } : undefined}>
        <div style={{ display: 'inline-block', color: muted, fontWeight: 500 }}>{label}</div>
        {body ? <>: {body}</> : null}
      </div>
    </div>
    {children}
  </li>
);

// The label and sub-bullet text are `<div style={{ display: 'inline-block' }}>` with the prop as
// their sole child. The inspector climbs past <span>/<b>/<i> (inline text) to the nearest
// non-inline ancestor, so a <span> here would let the click resolve to the whole <li> and
// edit parent + sub-bullets as one paragraph. A <div> stops the climb at exactly this line, and
// its source resolves to this call site's `label` / `text` prop.
const SubBullet = ({ text }: { text: string }) => (
  <div style={{ display: 'flex', gap: 4, paddingLeft: 9 }}>
    <span aria-hidden="true">-</span>
    <div style={{ display: 'inline-block' }}>{text}</div>
  </div>
);

const CompactEntry = ({ title, body }: { title: string; body: string }) => (
  <p style={{ fontSize: 12, lineHeight: 1.5, color: muted, margin: 0 }}>
    <span style={{ fontWeight: 500, color: 'var(--osd-text)' }}>{title}: </span>
    {body}
  </p>
);

const SkillCell = ({ title, body }: { title: string; body: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
    <p style={{ fontSize: 12, lineHeight: 1.4, color: muted, margin: 0 }}>{body}</p>
  </div>
);

const Continued = () => (
  <div style={{ marginTop: 'auto', textAlign: 'right' }}>
    <span style={{ fontSize: 12, color: muted, fontFamily: mono }}>continued →</span>
  </div>
);

const ResumePageOne: Page = () => (
  <div style={page}>
    <div style={content}>
      <Header />
      <div style={sections}>
        <p style={{ fontSize: 12, lineHeight: 1.45, color: muted, margin: 0 }}>
          A short, specific summary of who you are and what you do — the years of experience,
          the domain, and the kind of problems you gravitate toward. Two or three sentences that
          a hiring manager can read in under ten seconds and know whether to keep reading.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionTitle>Core skills &amp; expertise</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            <SkillCell
              title="Skill category one"
              body="A sentence describing what you actually do within this skill area, specific enough to be credible."
            />
            <SkillCell
              title="Skill category two"
              body="Another concrete description — tools, frameworks, or methods you use, not just the category name."
            />
            <SkillCell
              title="Skill category three"
              body="What sets your approach apart in this area, stated plainly rather than as a buzzword list."
            />
            <SkillCell
              title="Skill category four"
              body="Technical or domain-specific detail that a reader in this field would recognize and value."
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionTitle>Relevant experience</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Entry date="Jan 2023 – Present" company="Company Name" roleTitle="Your Role Title">
              <Bullet label="Lead with the outcome — what changed, by how much, for whom">
                <SubBullet text="First supporting detail, outcomes first" />
                <SubBullet text="A second supporting detail, if it earns its place." />
              </Bullet>
              <Bullet label="A second result-led bullet, specific and measurable">
                <SubBullet text="How you got there, in one clear line." />
              </Bullet>
              <Bullet
                label="A third bullet worth calling out with emphasis"
                emphasis
              >
                <SubBullet text="Supporting detail one." />
                <SubBullet text="Supporting detail two." />
              </Bullet>
            </Entry>
            <Entry date="Jun 2020 – Dec 2022" company="Previous Company" roleTitle="Prior Role Title">
              <Bullet label="A headline result from this role">
                <SubBullet text="The specific action that drove it." />
              </Bullet>
              <Bullet label="Another result worth including" />
            </Entry>
          </div>
        </div>
      </div>

      <Continued />
    </div>
  </div>
);

const ResumePageTwo: Page = () => (
  <div style={page}>
    <div style={content}>
      <div style={sections}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionTitle>Relevant experience (continued)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Entry date="Mar 2018 – May 2020" company="Earlier Company" roleTitle="Earlier Role">
              <Bullet
                label="A one-line result"
                body="A longer description when the bullet reads better as a single sentence than as label plus sub-bullets."
              />
              <Bullet
                label="A second one-line result"
                body="Same pattern — use this shape for roles where the detail doesn't need to be broken out further."
              />
            </Entry>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionTitle>Past experience</SectionTitle>
          <Entry date="2014 – 2018" company="Various organizations" roleTitle="Earlier job titles">
            <Bullet label="A brief note on earlier work, kept short since it's less relevant now" />
          </Entry>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>Talks &amp; achievements</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CompactEntry title="A talk, award, or notable side project" body="One line of context." />
              <CompactEntry title="A publication or recognition" body="Where it appeared or who recognized it." />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionTitle>Education &amp; certifications</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CompactEntry title="Degree Name" body="Institution Name" />
              <CompactEntry title="Certification Name" body="Issuing Organization" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${hair}` }}>
        <ContactMeta />
      </div>
    </div>
  </div>
);

export const meta: SlideMeta = {
  title: 'Resume template 1',
  theme: 'lars',
};

export default [ResumePageOne, ResumePageTwo] satisfies Page[];
