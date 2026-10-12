import type { DesignSystem, Page, SlideMeta } from '@open-slide/core';
import type { ReactNode } from 'react';

const FONT_HREFS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap',
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400&display=swap',
];
const FONT_LINK_ID = 'osd-webfont-letter-template';
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

// Single source of truth for contact details, so every placement (header, footer,
// letter) stays in sync instead of drifting into different phone formats/orders.
const CONTACT = {
  email: 'you@example.com',
  phone: '+1 555 010 1234',
  website: 'yoursite.com',
} as const;

// Only fields that should render as clickable links carry an href — email/phone stay
// plain text on the page (no mailto:/tel: requested), website/linkedin open the profile.
const CONTACT_LINKS: Partial<Record<keyof typeof CONTACT, string>> = {
  website: 'https://yoursite.com',
};

// fontSize defaults to 12 (the document rule); the header's contact line is a deliberate
// exception at 11px so the full line fits without wrapping — not a general precedent.
const ContactMeta = ({
  fields = ['email', 'phone', 'website'],
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
const Header = ({ headline }: { headline?: string }) => {
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
      {headline ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {name}
          <span style={{ fontSize: 12, fontWeight: 500, color: muted }}>{headline}</span>
        </div>
      ) : (
        name
      )}
      <ContactMeta align="right" fontSize={11} />
    </div>
  );
};

const LetterParagraph = ({ text }: { text: string }) => (
  <p style={{ fontSize: 12, lineHeight: 1.6, color: muted, margin: 0 }}>
    <span style={{ display: 'inline-block' }}>{text}</span>
  </p>
);

const LetterList = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
);

// A list item with a bold lead and a sentence. A link, shown as its visible address, is optional.
const LetterBullet = ({
  title,
  body,
  href,
  address,
}: {
  title: string;
  body: string;
  href?: string;
  address?: string;
}) => (
  <div style={{ fontSize: 12, lineHeight: 1.6, color: muted, display: 'flex', gap: 6 }}>
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        marginTop: 8,
        width: 3,
        height: 3,
        borderRadius: '50%',
        background: muted,
      }}
    />
    <div>
      <div style={{ display: 'inline-block', fontWeight: 500, color: 'var(--osd-text)' }}>
        {title}
      </div>{' '}
      <div style={{ display: 'inline-block' }}>{body}</div>
      {href && address ? (
        <>
          {' '}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#1D4ED8',
              textDecoration: 'underline',
              textDecorationColor: '#A5B8F0',
              textUnderlineOffset: 2,
            }}
          >
            {address}
          </a>
        </>
      ) : null}
    </div>
  </div>
);

const Letter: Page = () => (
  <div style={page}>
    <div style={content}>
      <Header />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LetterParagraph text="1 January 2027" />
        <LetterParagraph text="Recipient Name, Position, Organisation, Street Address, City Postcode" />
        <LetterParagraph text="Our reference: ABC-001" />
        <LetterParagraph text="Dear Recipient Name," />
        <LetterParagraph text="Re: The subject of the letter, in one line" />
        <LetterParagraph text="State the purpose of the letter in the first sentence, so the reader knows why you are writing and what you need from them." />
        <LetterParagraph text="Give the details that support it: dates, amounts, names and reference numbers. Keep to one subject, and keep each paragraph to one idea." />
        <LetterParagraph text="If you refer to other documents, list them:" />
        <LetterList>
          <LetterBullet title="Attachment A." body="A short description of the first attachment." />
          <LetterBullet title="Attachment B." body="A short description of the second attachment." />
        </LetterList>
        <LetterParagraph text="Say what you would like to happen next and by when, and how the reader can reach you." />
        <LetterParagraph text="Yours sincerely," />
        <LetterParagraph text="Your Name" />
      </div>
    </div>
  </div>
);

export const meta: SlideMeta = {
  title: 'Letter template',
  theme: 'lars',
  createdAt: '2026-10-10T00:00:00.000Z',
};

export default [Letter] satisfies Page[];
