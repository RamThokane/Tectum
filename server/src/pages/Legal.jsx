import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Navbar';
import { useAuthStore } from '../store/auth';
import { LEGAL, LEGAL_DOCS, LAST_UPDATED } from '../lib/legal';
import { cn } from '../lib/format';

/** A value from LEGAL; unfilled [placeholders] are highlighted so they're easy to spot. */
function V({ k }) {
  const value = LEGAL[k];
  if (value.startsWith('[')) return <mark className="rounded bg-warning-soft px-1 text-ink">{value}</mark>;
  return value;
}
const Mail = ({ k = 'email' }) => (
  <a href={`mailto:${LEGAL[k]}`} className="text-link underline underline-offset-2">{LEGAL[k]}</a>
);
const Doc = ({ to, children }) => (
  <Link to={`/legal/${to}`} className="text-link underline underline-offset-2">{children}</Link>
);
const H = ({ children, id }) => <h2 id={id} className="font-editorial font-medium mt-8 scroll-mt-24 text-[20px]">{children}</h2>;
const P = ({ children }) => <p className="mt-3">{children}</p>;
const UL = ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5">{children}</ul>;

// ---------------------------------------------------------------- Terms
function Terms() {
  return (
    <>
      <P>
        These Terms of Service ("Terms") are an agreement between you and <V k="operator" /> ("Tectum", "we", "us"), the
        operator of the Tectum website and app (the "Service"). By creating an account or using the Service you agree to
        these Terms, our <Doc to="privacy">Privacy Policy</Doc> and our <Doc to="guidelines">Community Guidelines</Doc>. If you
        do not agree, do not use Tectum.
      </P>

      <H>1. What Tectum is, and what it is not</H>
      <P>
        Tectum is a professional community where medical students, doctors, nurses, researchers and other healthcare workers
        share cases, notes and discussion for <strong>education</strong>.
      </P>
      <UL>
        <li><strong>Not medical advice.</strong> Nothing on Tectum is medical advice, diagnosis or treatment for any patient. Always use your own clinical judgement, local guidelines and senior supervision.</li>
        <li><strong>Not for emergencies.</strong> Do not use Tectum to get help for a patient or yourself in an emergency.</li>
        <li><strong>Not a patient service.</strong> Patients and members of the public should consult a qualified doctor.</li>
        <li>Content is written by members. We do not check it for accuracy and do not endorse it.</li>
      </UL>

      <H>2. Who can use Tectum</H>
      <UL>
        <li>You must be <strong>at least 18 years old</strong>.</li>
        <li>You must give true information about yourself, including your name and your role (student, doctor, nurse and so on).</li>
        <li>One person, one identity. Do not impersonate anyone or claim qualifications you do not have.</li>
        <li>We may refuse or close accounts that break these Terms.</li>
      </UL>

      <H>3. Your account</H>
      <P>
        Keep your password safe and do not share your account. You are responsible for what happens under your account. Tell
        us at <Mail /> if you think someone else has accessed it.
      </P>

      <H>4. Verification and the blue tick</H>
      <UL>
        <li>You may upload a licence, registration certificate or student ID. An administrator checks it and, if satisfied, marks your account as verified. A tick means we saw a document that looked genuine. It is not a guarantee of anyone's identity or competence.</li>
        <li><strong>Blue tick:</strong> every verified member gets the blue tick <strong>free of charge</strong>. It comes with higher placement of your posts in feeds, longer posts and no ads.</li>
        <li>We may remove the tick if a document turns out to be false or the account breaks these Terms.</li>
      </UL>

      <H>5. Your content</H>
      <P>
        You keep ownership of what you post (text, cases, images, notes files and comments). By posting, you give Tectum a
        worldwide, non-exclusive, royalty-free licence to host, store, copy, display and distribute that content <strong>for the
        purpose of running the Service</strong> (for example, showing it to other members and making backups). This licence ends
        when you delete the content or your account, except for copies other members have already downloaded and copies kept
        for a limited time in backups.
      </P>
      <P>When you post, you promise that:</P>
      <UL>
        <li>you made it yourself or have permission to share it, and it does not infringe anyone's copyright (no textbook pages, paid course or coaching material, question banks or other people's notes);</li>
        <li><strong>it contains no information that could identify a patient</strong>: names, initials, exact dates, hospital or ward names, record numbers, addresses, phone numbers, or photos showing faces, tattoos or other identifying features;</li>
        <li>where the law or your institution requires patient consent for sharing a case or image for education, you have it;</li>
        <li>it follows our <Doc to="guidelines">Community Guidelines</Doc> and Indian law.</li>
      </UL>

      <H>6. Things you must not do</H>
      <UL>
        <li>Post anything unlawful, defamatory, obscene, hateful, harassing, or that threatens anyone.</li>
        <li>Give personalised medical advice to members of the public, or promote unproven treatments.</li>
        <li>Post spam, advertising or paid promotion without our written permission.</li>
        <li>Try to break, overload, scrape or reverse-engineer the Service, or access other people's accounts.</li>
        <li>Upload viruses or anything designed to harm devices.</li>
        <li>Anything prohibited under Rule 3(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</li>
      </UL>

      <H>7. Advertising</H>
      <P>
        Tectum shows ads to help keep the Service running. Ads are always labelled "Sponsored" or "Promoted" and are shown to
        all members alike, not targeted at you personally. Blue tick members do not see ads. An ad is not a recommendation or endorsement by Tectum, and we are
        not responsible for advertisers' products, services or websites. Advertisers must follow our{' '}
        <Doc to="advertising">Advertising Policy</Doc>. Members may not post paid promotion as ordinary posts.
      </P>

      <H>8. Moderation</H>
      <P>
        Members can report posts. Our moderators review reports and may blur, hide or remove content, and warn, suspend or close
        accounts. Uploaded images are checked automatically (including by an AI system) and may be blurred or sent for review.
        We are not obliged to monitor everything and are not responsible for content posted by members, but we act on reports
        and on lawful orders from courts or government agencies as required by the IT Act, 2000 and its rules.
      </P>

      <H>9. Copyright complaints</H>
      <P>
        If you believe something on Tectum infringes your copyright, email <Mail k="grievanceEmail" /> with: the link to the
        content, what work you own, and a statement that you are the owner or authorised to act for them. We will remove
        infringing material and may close accounts of repeat infringers.
      </P>

      <H>10. Leaving Tectum</H>
      <P>
        You can deactivate your account (hidden until you log in again) or delete it permanently in Settings. Deleting removes
        your profile, posts, comments and uploaded files. We may suspend or close your account if you break these Terms, or if
        we have to by law.
      </P>

      <H>11. Changes to the Service and these Terms</H>
      <P>
        Tectum is a new, evolving service. Features may change or stop. We may update these Terms; if a change is significant
        we will tell you in the app or by email before it applies. Continuing to use Tectum after that means you accept the new
        Terms.
      </P>

      <H id="disclaimer">12. Disclaimers and limits of liability</H>
      <P>
        The Service is provided "as is" and "as available". To the fullest extent the law allows, we give no warranties about
        accuracy, availability or fitness for a purpose, and we are not liable for any indirect or consequential loss, or for
        decisions made (clinical or otherwise) based on content on Tectum. Where we are liable, our total liability is limited to
        the amount you paid us, if any, in the 12 months before the claim. Nothing here limits liability that cannot be limited by law.
      </P>

      <H>13. Indemnity</H>
      <P>
        If someone makes a claim against us because of content you posted or your breach of these Terms, you agree to cover our
        reasonable losses and costs arising from it.
      </P>

      <H>14. Law and disputes</H>
      <P>
        These Terms are governed by the laws of India. Courts at <V k="city" /> have exclusive jurisdiction. Please contact us
        first at <Mail /> so we can try to resolve any problem informally.
      </P>

      <H>15. Contact</H>
      <P>
        <V k="operator" />, <V k="address" />. Email: <Mail />. Grievances: see{' '}
        <Doc to="grievance">Grievance Officer &amp; Contact</Doc>.
      </P>
    </>
  );
}

// ---------------------------------------------------------------- Privacy
function Privacy() {
  return (
    <>
      <P>
        This policy explains what personal data Tectum collects, why, who it is shared with, and your rights. It is written to
        meet the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000 and its rules. The data
        fiduciary (the one responsible for your data) is <V k="operator" />, contactable at <Mail />.
      </P>

      <H>1. What we collect</H>
      <UL>
        <li><strong>Account details:</strong> name, email address, password (stored only as a secure hash), your role, institution, specialties and bio.</li>
        <li><strong>If you sign in with Google:</strong> your name, email, Google account ID and profile photo, as shared by Google.</li>
        <li><strong>Photos:</strong> profile picture and cover photo, if you add them.</li>
        <li><strong>Verification documents:</strong> the licence, registration certificate or student ID you upload to get verified. These are stored privately and can only be opened by our administrators.</li>
        <li><strong>What you post:</strong> posts, case studies, images, notes files, comments, likes, reposts, saves, follows, reports and "who can reply" settings.</li>
        <li>
          <strong>Private messages:</strong> direct messages are <strong>end-to-end encrypted</strong> on your device. We store only
          the encrypted text, which we cannot read, plus who messaged whom and when (needed to deliver them). Your chat
          passphrase never reaches us; we keep only an encrypted backup of your chat key that only that passphrase can open, so
          we cannot recover your messages if you forget it.
        </li>
        <li><strong>Support messages</strong> you send us.</li>
        <li><strong>Technical data:</strong> login sessions (cookies, see below), IP address and basic request logs used for security and fixing errors, and your settings (for example dark mode and notification choices).</li>
      </UL>
      <P>We do <strong>not</strong> want patient data. Never post information that could identify a patient.</P>

      <H>2. Why we use it</H>
      <UL>
        <li>To create and run your account and show your profile and posts to other members.</li>
        <li>To verify members and show ticks.</li>
        <li>To send notifications and service emails (for example password resets).</li>
        <li>To keep Tectum safe: preventing abuse, checking uploaded images for sensitive or identifying content, and moderating reports.</li>
        <li>To meet legal obligations and respond to lawful requests.</li>
      </UL>
      <P>
        We rely on your <strong>consent</strong>, given when you create an account, and on legitimate uses permitted by law. We do{' '}
        <strong>not</strong> sell your data.
      </P>
      <P>
        <strong>Ads:</strong> Tectum shows some sponsored content. Ads are <strong>not personalised</strong>: every member sees
        ads from the same pool, and we do not use your profile, posts or activity to choose them. We count how many times each
        ad was shown and clicked, in total only, and we never share your personal data with advertisers. When you click an ad
        you leave Tectum, and the advertiser's own privacy policy applies on their site.
      </P>

      <H>3. What other members can see</H>
      <P>
        Tectum is a social platform. Your name, photo, role, institution, bio, specialties, followers, following, posts, comments
        and likes are visible to other logged-in members. Your email address, password and verification documents are never
        shown to other members.
      </P>

      <H>4. Service providers we share data with</H>
      <P>We use trusted providers to run Tectum. They may only use your data to provide their service to us.</P>
      <UL>
        <li><strong>MongoDB Atlas</strong>: database hosting.</li>
        <li><strong>Render</strong>: website and server hosting.</li>
        <li><strong>Cloudinary</strong>: storage for images, notes files and (privately) verification documents.</li>
        <li><strong>Google</strong>: "Continue with Google" sign-in, and email delivery.</li>
        <li><strong>Anthropic</strong>: automated review of uploaded images for graphic or identifying content, when this feature is switched on.</li>
      </UL>
      <P>
        Some of these providers store data on servers outside India. Where we transfer data abroad, we do so only as permitted
        under Indian law. We will also share data if required by law, a court order or a government agency with legal authority.
      </P>

      <H>5. Cookies and local storage</H>
      <UL>
        <li>A secure, httpOnly <strong>login cookie</strong> keeps you signed in, and a second one remembers accounts you've used on this browser for account switching.</li>
        <li>Your browser's local storage keeps small preferences such as dark mode and dismissed tips.</li>
        <li>We do not use advertising or third-party tracking cookies.</li>
      </UL>

      <H>6. How long we keep data</H>
      <UL>
        <li>We keep your account data while your account exists. Deactivating hides your account but keeps the data so you can come back.</li>
        <li><strong>Deleting your account</strong> (Settings) permanently removes your profile, posts, comments, likes, follows, private conversations and uploaded files, including your verification document. Copies in backups and logs are overwritten within about 30 days.</li>
        <li>We may keep limited information longer if the law requires it, or to deal with a legal claim or an abuse investigation.</li>
      </UL>

      <H>7. Your rights</H>
      <P>Under the DPDP Act, 2023 you can:</P>
      <UL>
        <li><strong>Access</strong> your data: Settings → Privacy &amp; Data → download a copy.</li>
        <li><strong>Correct</strong> it: edit your profile in Settings, or ask us.</li>
        <li><strong>Erase</strong> it: delete your account in Settings.</li>
        <li><strong>Withdraw consent</strong>: delete your account (this does not affect what we did lawfully before).</li>
        <li><strong>Nominate</strong> someone to exercise your rights if you die or become unable to, by emailing us.</li>
        <li><strong>Complain</strong> to our <Doc to="grievance">Grievance Officer</Doc>, and then to the Data Protection Board of India if you are not satisfied.</li>
      </UL>

      <H>8. Security</H>
      <P>
        Passwords are hashed, connections are encrypted (HTTPS), verification documents are stored privately, and access to
        admin tools is restricted. No system is perfectly secure. If a breach affects your data we will inform you and the
        authorities as the law requires.
      </P>

      <H>9. Children</H>
      <P>Tectum is only for people aged 18 or over. If we learn that an account belongs to someone under 18, we will delete it.</P>

      <H>10. Changes</H>
      <P>We will post any update here with a new date, and tell you in the app or by email if the change is significant.</P>

      <H>11. Contact</H>
      <P>
        Questions or requests: <Mail />. Grievance Officer: <V k="grievanceOfficer" />, <Mail k="grievanceEmail" />.
      </P>
    </>
  );
}

// ---------------------------------------------------------------- Guidelines
function Guidelines() {
  return (
    <>
      <P>
        Tectum works because members trust what they read and feel safe posting. These rules apply to every post, comment,
        image, notes file and profile. Breaking them can lead to removal, a warning, suspension or a permanent ban.
      </P>

      <H>Protect patients</H>
      <UL>
        <li>De-identify every case. No names, initials, dates of birth, exact dates, hospital or ward names, record numbers, addresses, or phone numbers.</li>
        <li>Use age ranges ("50s") rather than exact ages where the age isn't clinically needed.</li>
        <li>
          No photos showing faces, tattoos, jewellery or anything else that could identify someone. Crop them, or use the "Blur faces or
          details" tool when you attach an image.
        </li>
        <li>Follow your institution's rules on consent for sharing cases and images for teaching. You confirm this every time you post a case or an image.</li>
        <li>Hidden photo data (such as GPS location, camera details and the date taken) is removed automatically from every image you upload.</li>
        <li>Mark graphic images as sensitive so they are blurred for viewers.</li>
      </UL>

      <H>Respect copyright</H>
      <UL>
        <li>Only upload notes and images you made yourself or have permission to share.</li>
        <li>No textbook pages or scans, paid course or coaching notes, question banks, or other people's notes.</li>
        <li>When quoting a guideline or paper, keep it short and cite the source.</li>
      </UL>

      <H>Be accurate and honest</H>
      <UL>
        <li>Say when something is your opinion or experience, and cite evidence where you can.</li>
        <li>No medical misinformation, and no promotion of unproven or dangerous treatments.</li>
        <li>No personalised medical advice to members of the public.</li>
        <li>Don't claim a role, qualification or tick you don't have.</li>
      </UL>

      <H>Be professional</H>
      <UL>
        <li>Disagree with ideas, not people. No harassment, bullying, threats or hate based on religion, caste, gender, sexuality, disability, region or anything else.</li>
        <li>No sexual content, and no mocking of patients or colleagues.</li>
        <li>No spam, self-promotion, referral codes or selling without permission.</li>
      </UL>

      <H>Reporting</H>
      <P>
        Use the ⋯ menu on any post to report it. Our moderators review every report. For urgent problems, especially a patient's
        privacy, email <Mail k="grievanceEmail" />.
      </P>
    </>
  );
}

// ---------------------------------------------------------------- Advertising
function Advertising() {
  return (
    <>
      <P>
        Tectum's members are medical students and healthcare professionals, so ads here must meet a higher bar. This policy
        applies to every ad we run. We review each ad before it goes live and may refuse or remove any ad at our discretion.
      </P>

      <H>How ads appear</H>
      <UL>
        <li>Ads are clearly labelled <strong>"Sponsored"</strong> (side panel) or <strong>"Promoted"</strong> (in the feed), with the advertiser's name.</li>
        <li>Ads are <strong>not targeted</strong>: every member sees ads from the same pool. Advertisers never receive members' personal data.</li>
        <li>Blue tick members have an ad-free Tectum, so ads are shown only to other members.</li>
        <li>Advertisers receive only total numbers of views and clicks for their own ads.</li>
        <li>Running an ad does not buy any influence over what members post or what we moderate.</li>
      </UL>

      <H>What we welcome</H>
      <UL>
        <li>Medical education: courses, exam preparation, question banks (your own), books and learning apps.</li>
        <li>Conferences, CMEs, workshops and fellowships.</li>
        <li>Jobs, residencies and recruitment at genuine institutions.</li>
        <li>Medical equipment, clinical tools and software for professionals.</li>
        <li>Research studies with ethics approval.</li>
      </UL>

      <H>What we don't allow</H>
      <UL>
        <li><strong>Prescription-only medicines</strong> (for example Schedule H, H1 or X drugs). These may not be advertised to the public in India.</li>
        <li>Anything prohibited by the <strong>Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954</strong>, including claims to cure or prevent the diseases it lists, and "miracle" or magic cures.</li>
        <li>Unproven or dangerous treatments, and health claims without good scientific evidence.</li>
        <li>Ads by individual doctors promoting their own practice in breach of the National Medical Commission's professional conduct rules.</li>
        <li>Guaranteed exam results or ranks, fake degrees, paper leaks, or anything that breaks exam rules.</li>
        <li>Tobacco, alcohol, gambling, betting, adult content, weapons, crypto and "get rich" schemes.</li>
        <li>Misleading, exaggerated or disguised ads, and anything that breaks the ASCI Code or consumer protection law.</li>
        <li>Ads that collect personal or patient data without clear consent, or that link to malware or phishing.</li>
      </UL>

      <H>Advertiser responsibilities</H>
      <UL>
        <li>You are responsible for your ad being truthful and lawful, and for any licences or approvals it needs.</li>
        <li>You must own, or have permission to use, the text, images and trademarks in your ad.</li>
        <li>The page your ad links to must match the ad and work properly.</li>
      </UL>

      <H>Advertise on Tectum</H>
      <P>
        Email <Mail /> with your organisation, what you'd like to promote, and the dates. Prices and terms for each campaign are
        agreed in writing before it starts.
      </P>

      <H>Report an ad</H>
      <P>If an ad looks wrong or misleading, email <Mail k="grievanceEmail" /> with the advertiser's name and we'll review it.</P>
    </>
  );
}

// ---------------------------------------------------------------- Grievance
function Grievance() {
  return (
    <>
      <P>
        In line with the Information Technology Act, 2000, the Information Technology (Intermediary Guidelines and Digital Media
        Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023, the Grievance Officer for Tectum is:
      </P>
      <div className="mt-4 rounded-[12px] border border-line p-4 leading-7">
        <p><span className="muted">Name:</span> <V k="grievanceOfficer" /></p>
        <p><span className="muted">Email:</span> <Mail k="grievanceEmail" /></p>
        <p><span className="muted">Address:</span> <V k="address" /></p>
        <p><span className="muted">Operated by:</span> <V k="operator" /></p>
      </div>

      <H>What you can raise</H>
      <UL>
        <li>Content that breaks our rules or the law, including a patient's private information, copyright infringement, impersonation or harassment.</li>
        <li>Requests about your personal data (access, correction, erasure).</li>
        <li>Problems with your account or verification.</li>
      </UL>

      <H>How it works</H>
      <UL>
        <li>We acknowledge your complaint within <strong>24 hours</strong> and resolve it within <strong>15 days</strong>.</li>
        <li>Complaints about content that exposes someone's private area, shows them in a sexual act, or impersonates them are acted on within <strong>24 hours</strong>.</li>
        <li>Please include links to the content, what the problem is, and how to reach you.</li>
      </UL>

      <H>General contact</H>
      <P>For everything else, email <Mail />, or use Help &amp; Support in Settings once you're logged in.</P>
    </>
  );
}

const CONTENT = { terms: Terms, privacy: Privacy, guidelines: Guidelines, advertising: Advertising, grievance: Grievance };

/** Public legal pages: /legal/terms, /legal/privacy, ... Readable logged in or out. */
export default function Legal() {
  const { doc } = useParams();
  const loggedIn = useAuthStore((s) => s.status === 'authenticated');
  const current = LEGAL_DOCS.find((d) => d.slug === doc);
  useEffect(() => {
    if (current) document.title = `${current.title} · Tectum`;
    // Jump to a section when the link has one (e.g. /legal/terms#disclaimer), else start at the top.
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    return () => {
      document.title = 'Tectum';
    };
  }, [current]);
  if (!current) return <Navigate to="/legal/terms" replace />;
  const Body = CONTENT[current.slug];

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link to={loggedIn ? '/home' : '/'} className="-ml-2 rounded-full p-2 hover:bg-surface-2" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 md:flex-row">
        <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:w-56 md:shrink-0 md:flex-col md:px-0" aria-label="Legal documents">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              to={`/legal/${d.slug}`}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-[15px] transition hover:bg-surface-2',
                d.slug === current.slug && 'font-semibold'
              )}
              aria-current={d.slug === current.slug ? 'page' : undefined}
            >
              {d.title}
            </Link>
          ))}
        </nav>

        <article className="min-w-0 max-w-2xl flex-1 pb-16 text-[15px] leading-6 text-ds-fg-2">
          <h1 className="font-editorial font-medium text-[28px] text-ink">{current.title}</h1>
          <p className="muted mt-1 text-[13px]">Last updated {LAST_UPDATED}</p>
          <Body />
        </article>
      </div>
    </div>
  );
}
