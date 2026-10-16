import { useEffect, useState } from 'react';
import { Search, Filter, MoreHorizontal, Pencil, Trash2, Flag, Link2, Bell, Inbox, Stethoscope, BookOpen, Users, Hospital, Heart, MessageCircle, Bookmark, Share, Settings, Home as HomeIcon } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cn } from '../lib/format';
import { DsTheme } from '../components/ds/theme';
import { Button, IconButton } from '../components/ds/Button';
import { Field, Input, Textarea, Select, DateInput, PasswordField, SearchInput, Checkbox, Radio, Switch } from '../components/ds/forms';
import { Card, GlassPanel, Modal, Dropdown, Popover, Tooltip, Toast, ToastViewport, HoverCard, toast } from '../components/ds/surfaces';
import { Tabs, SegmentedControl } from '../components/ds/navigation';
import { Chip, RoleBadge, Badge, Avatar, AvatarGroup, StatRow, Progress, Skeleton, CardSkeleton, EmptyState, ErrorState, SpecialtyDot } from '../components/ds/display';
import { CaseCard, Poll, CommentThread, ChatView, NotificationList, NotebookSurface, ComposeButton, Vital } from '../components/ds/medical';
import { StreakFlame, CollabIcon, StudyIcon, VerifiedShield } from '../components/ds/icons';

// The new typefaces: loaded by this page only, until the app itself moves to the new system.
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap';

// ---------------------------------------------------------------- sample data
const people = [
  { _id: '1', name: 'Dr. Priya Sharma', role: 'doctor', verified: true },
  { _id: '2', name: 'Arjun Mehta', role: 'student', verified: true },
  { _id: '3', name: 'Maria Lopez', role: 'nurse', verified: false },
  { _id: '4', name: 'Kenji Tanaka', role: 'researcher', verified: true },
  { _id: '5', name: 'Sara Ahmed', role: 'student' },
  { _id: '6', name: 'Daniel Okafor', role: 'doctor', verified: true },
];
const sampleCase = {
  id: 'c1',
  caseId: 'TC-0412',
  specialty: { label: 'Cardiology', hue: 'rose' },
  title: 'Crushing central chest pain for two hours, radiating to the jaw',
  presentation: (
    <>
      A 54-year-old smoker presents with chest pain at rest, sweating and nausea. <Vital>HR 52</Vital>, <Vital>BP 88/60</Vital>, JVP raised, lungs clear. ECG shows ST elevation in II, III and aVF.
    </>
  ),
  author: people[0],
  time: '2h',
  difficulty: 'medium',
  votes: 48,
  answers: 12,
  solved: true,
};
const caseWithImage = {
  ...sampleCase,
  id: 'c2',
  caseId: 'TC-0413',
  specialty: { label: 'Radiology', hue: 'indigo' },
  title: 'Breathless after a long-haul flight',
  presentation: 'A 38-year-old woman, 2 days after a 14-hour flight, with pleuritic chest pain and a swollen left calf.',
  image: 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'><rect width='640' height='360' fill='#16181d'/><ellipse cx='240' cy='180' rx='110' ry='140' fill='#2b2f38'/><ellipse cx='400' cy='180' rx='110' ry='140' fill='#2b2f38'/><rect x='308' y='40' width='24' height='280' rx='10' fill='#565c68'/></svg>"),
  imageAlt: 'Chest X-ray (illustration)',
  author: people[3],
  solved: false,
};
const thread = [
  {
    id: 't1',
    author: people[1],
    time: '1h',
    likes: 14,
    text: 'Inferior STEMI with hypotension and a raised JVP: I would get right-sided leads before anything else.',
    replies: [
      { id: 't2', author: people[0], time: '48m', likes: 9, text: 'Exactly. V4R elevation confirms RV involvement, so hold the nitrates and give fluids carefully.' },
      { id: 't3', author: people[2], time: '30m', likes: 3, text: 'In our ED we also start a bolus while the cath lab is called.' },
    ],
  },
  { id: 't4', author: people[3], time: '12m', likes: 2, text: 'Worth remembering: bradycardia here often comes from RCA occlusion affecting the SA / AV nodes.' },
];
const chat = [
  { id: 'm1', text: 'Did you see the case Priya posted this morning?', time: '09:14' },
  { id: 'm2', mine: true, text: 'Yes! I got the RV infarct right.', time: '09:15' },
  { id: 'm3', text: 'Nice. Want to revise the ECG flashcards tonight?', time: '09:16' },
  { id: 'm4', mine: true, text: 'Sure, 8 pm works.', time: '09:16' },
];
const notifications = [
  {
    label: 'Today',
    items: [
      { id: 'n1', type: 'reply', who: 'Dr. Priya Sharma', what: 'replied to your answer', excerpt: 'Exactly. V4R elevation confirms RV involvement…', time: '12m', unread: true },
      { id: 'n2', type: 'like', who: 'Arjun Mehta and 4 others', what: 'liked your pearl', time: '1h', unread: true },
      { id: 'n3', type: 'follow', who: 'Kenji Tanaka', what: 'started following you', time: '3h' },
    ],
  },
  {
    label: 'Earlier',
    items: [
      { id: 'n4', type: 'verified', who: 'Tectum', what: 'verified your student ID', time: 'Mon' },
      { id: 'n5', type: 'mention', who: 'Maria Lopez', what: 'mentioned you in Emergency Medicine', time: 'Sep 28' },
    ],
  },
];

// ---------------------------------------------------------------- layout helpers
function Section({ id, title, intro, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t border-ds-line py-10 first:border-t-0 first:pt-2">
      <h2 id={`${id}-h`} className="font-editorial text-headline font-medium text-ds-fg">{title}</h2>
      {intro && <p className="mt-1.5 max-w-xl text-body text-ds-fg-3">{intro}</p>}
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  );
}
function Demo({ label, children, className }) {
  return (
    <div>
      <p className="ds-eyebrow mb-3">{label}</p>
      <div className={className}>{children}</div>
    </div>
  );
}
function Swatch({ name, token, text }) {
  return (
    <div className="min-w-0">
      <div className="h-14 rounded-ds-md border border-ds-line" style={{ background: `var(${token})` }} />
      <p className="mt-1.5 truncate text-meta font-medium text-ds-fg">{name}</p>
      <p className="truncate font-code text-caption text-ds-fg-3">{text ?? token}</p>
    </div>
  );
}

// ---------------------------------------------------------------- the library, drawn once per theme
function Library({ theme }) {
  const [tab, setTab] = useState('posts');
  const [seg, setSeg] = useState('week');
  const [modal, setModal] = useState(false);
  const [check, setCheck] = useState(true);
  const [radio, setRadio] = useState('student');
  const [sw, setSw] = useState(true);
  const [q, setQ] = useState('');
  const [chips, setChips] = useState(['cardiology']);
  const toggleChip = (c) => setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const t = theme === 'dark' ? 'Dark' : 'Light';

  return (
    <div className="relative isolate overflow-hidden">
      <div className="ds-mesh -z-10" aria-hidden="true" />
      <div className="mx-auto max-w-[720px] px-4 pb-24 sm:px-8">
        <p className="ds-eyebrow pt-8">{t} theme</p>

        {/* ------------------------------------------------ foundations */}
        <Section id={`${theme}-color`} title="Colour" intro="Cool neutrals carry the page. Blue is the only brand colour: primary actions, active states, links. Coral is rare: streaks, unread.">
          <Demo label="Neutrals" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Swatch name="Background" token="--ds-bg" />
            <Swatch name="Surface" token="--ds-surface" />
            <Swatch name="Surface 2" token="--ds-surface-2" />
            <Swatch name="Text" token="--ds-fg" />
            <Swatch name="Secondary" token="--ds-fg-2" />
            <Swatch name="Meta" token="--ds-fg-3" />
          </Demo>
          <Demo label="Brand, accent, semantic" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Swatch name="Blue" token="--ds-brand" text="#2563EB" />
            <Swatch name="Coral" token="--ds-accent" text="#F97362" />
            <Swatch name="Success" token="--ds-success" />
            <Swatch name="Warning" token="--ds-warning" />
            <Swatch name="Danger" token="--ds-danger" />
            <Swatch name="Info" token="--ds-info" />
          </Demo>
          <Demo label="Specialty dots (only ever small)" className="flex flex-wrap gap-x-5 gap-y-2">
            {['Cardiology', 'Radiology', 'Neurology', 'Psychiatry', 'Emergency', 'Paediatrics', 'Dermatology', 'General'].map((s, i) => (
              <span key={s} className="inline-flex items-center gap-2 text-meta text-ds-fg-2">
                <SpecialtyDot hue={i + 1} /> {s}
              </span>
            ))}
          </Demo>
        </Section>

        <Section id={`${theme}-type`} title="Type" intro="Newsreader for titles and names, Geist for everything you use, Geist Mono for values. Scale: 12 · 13 · 15 · 17 · 20 · 28 · 40.">
          <div className="space-y-4">
            <p className="font-editorial text-display font-medium text-ds-fg">One real case at a time</p>
            <p className="font-editorial text-headline font-medium text-ds-fg">Case Rounds · Headline 28</p>
            <p className="font-editorial text-title font-medium text-ds-fg">Inferior STEMI with RV involvement · Title 20</p>
            <p className="text-lead text-ds-fg-2">Lead 17. A short introduction or the opening of a case, set a little larger for reading.</p>
            <p className="text-body text-ds-fg-2">Body 15. Most text in the app. Comfortable line height, never pure black on white, never grey-on-grey below AA.</p>
            <p className="text-meta text-ds-fg-3">Meta 13 · posted 2h ago · 12 answers</p>
            <p className="text-caption text-ds-fg-3">Caption 12 · footnotes and fine print</p>
            <p className="ds-eyebrow">Eyebrow label 11 · tracked uppercase</p>
            <p className="font-code text-body text-ds-fg">Na 128 mmol/L · K 5.9 · Trop I 2.41 ng/mL · BP 88/60</p>
            <p className="ds-num font-ui text-headline font-medium text-ds-fg">1,284 · 97% · 46</p>
          </div>
        </Section>

        <Section id={`${theme}-shape`} title="Shape, space, depth" intro="Radius by role, not one size for everything. Most content is flat with a hairline; shadows only for things that float.">
          <Demo label="Radius: 6 inputs · 12 cards · 20 panels · 28 media · pill" className="flex flex-wrap items-end gap-4">
            {[['6', 'rounded-ds-sm'], ['12', 'rounded-ds-md'], ['20', 'rounded-ds-lg'], ['28', 'rounded-ds-xl'], ['pill', 'rounded-full']].map(([n, r]) => (
              <div key={n} className="text-center">
                <div className={cn('size-16 border border-ds-line-strong bg-ds-surface', r)} />
                <p className="mt-1.5 font-code text-caption text-ds-fg-3">{n}</p>
              </div>
            ))}
          </Demo>
          <Demo label="Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64" className="flex items-end gap-2">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
              <div key={n} className="text-center">
                <div className="w-4 rounded-sm bg-ds-brand-soft" style={{ height: n * 4 }} />
                <p className="mt-1 font-code text-caption text-ds-fg-3">{n * 4}</p>
              </div>
            ))}
          </Demo>
          <Demo label="Depth: flat · raised · floating · glass" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="ds-card flex h-20 items-center justify-center text-meta text-ds-fg-3">Flat</div>
            <div className="ds-card flex h-20 items-center justify-center text-meta text-ds-fg-3 shadow-ds-raised">Raised</div>
            <div className="ds-card flex h-20 items-center justify-center text-meta text-ds-fg-3 shadow-ds-floating">Floating</div>
            <GlassPanel className="flex h-20 items-center justify-center text-meta text-ds-fg-2">Glass</GlassPanel>
          </Demo>
          <Demo label="Icons: Lucide at 1.5px, plus our own for the old emojis" className="flex flex-wrap items-center gap-5 text-ds-fg-2">
            {[HomeIcon, Hospital, Stethoscope, BookOpen, Bell, Users, Heart, MessageCircle, Bookmark, Share, Settings].map((I, i) => (
              <I key={i} className="size-5" strokeWidth={1.5} aria-hidden="true" />
            ))}
            <span className="h-5 w-px bg-ds-line" aria-hidden="true" />
            <StreakFlame size={22} title="Streak (was 🔥)" />
            <span className="text-ds-fg-2"><CollabIcon size={22} /></span>
            <span className="text-ds-fg-2"><StudyIcon size={22} /></span>
            <span className="text-ds-brand-text"><VerifiedShield size={22} /></span>
          </Demo>
        </Section>

        {/* ------------------------------------------------ components */}
        <Section id={`${theme}-buttons`} title="Buttons">
          <Demo label="Variants" className="flex flex-wrap items-center gap-3">
            <Button>Post case</Button>
            <Button variant="secondary">Save draft</Button>
            <Button variant="outline">Follow</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger" icon={Trash2}>Delete</Button>
          </Demo>
          <Demo label="Sizes, loading, disabled, icon-only" className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button loading>Posting</Button>
            <Button disabled>Disabled</Button>
            <IconButton icon={Search} label="Search" />
            <IconButton icon={Bell} label="Notifications" variant="secondary" />
            <IconButton icon={Pencil} label="Edit" variant="outline" />
          </Demo>
        </Section>

        <Section id={`${theme}-forms`} title="Forms" intro="Labels above, hairline borders, a blue focus ring, errors inline under the field.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name">
              <Input placeholder="Dr. Jane Doe" defaultValue="Asha Rao" />
            </Field>
            <Field label="Email" error="Enter a valid email">
              <Input type="email" defaultValue="asha@" />
            </Field>
            <Field label="Course">
              <Select defaultValue="mbbs">
                <option value="mbbs">MBBS</option>
                <option value="bds">BDS</option>
                <option value="bsc-nursing">B.Sc Nursing</option>
              </Select>
            </Field>
            <Field label="Exam date" optional>
              <DateInput defaultValue="2026-11-14" />
            </Field>
            <Field label="Password" hint="8+ characters with a capital, a number and a symbol.">
              <PasswordField defaultValue="Tectum#2026" />
            </Field>
            <Field label="Search">
              <SearchInput value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Search cases, people, Wards" />
            </Field>
            <Field label="Learning point" className="sm:col-span-2">
              <Textarea placeholder="The one thing you want others to take away" />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <Demo label="Checkbox">
              <Checkbox label="Mark images as sensitive" description="Blurred until someone taps to see them" checked={check} onChange={setCheck} />
            </Demo>
            <Demo label="Radio" className="space-y-3">
              {['student', 'doctor'].map((r) => (
                <Radio key={r} name={`${theme}-role`} value={r} label={r === 'student' ? 'Student' : 'Doctor'} checked={radio === r} onChange={setRadio} />
              ))}
            </Demo>
            <Demo label="Switch">
              <Switch label="Email digest" description="A weekly summary" checked={sw} onChange={setSw} />
            </Demo>
          </div>
        </Section>

        <Section id={`${theme}-nav`} title="Tabs and segmented controls" intro="The indicator slides. Arrow keys move between options.">
          <Demo label="Tabs (sit in a sticky glass header on pages)">
            <GlassPanel className="rounded-ds-md px-2">
              <Tabs label="Profile sections" value={tab} onChange={setTab} items={[{ value: 'posts', label: 'Posts', count: 24 }, { value: 'cases', label: 'Cases', count: 6 }, { value: 'media', label: 'Media' }, { value: 'portfolio', label: 'Portfolio' }]} />
            </GlassPanel>
          </Demo>
          <Demo label="Segmented control">
            <SegmentedControl label="Range" value={seg} onChange={setSeg} items={[{ value: 'day', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'Month' }]} />
          </Demo>
        </Section>

        <Section id={`${theme}-display`} title="Chips, badges, avatars">
          <Demo label="Chips: outline with a specialty dot; selected in blue" className="flex flex-wrap gap-2">
            {[['cardiology', 'Cardiology', 'rose'], ['neurology', 'Neurology', 'indigo'], ['paediatrics', 'Paediatrics', 'amber'], ['emergency', 'Emergency', 'red']].map(([v, l, h]) => (
              <Chip key={v} hue={h} selected={chips.includes(v)} onClick={() => toggleChip(v)}>{l}</Chip>
            ))}
            <Chip>#ecg</Chip>
          </Demo>
          <Demo label="Role badges and counts" className="flex flex-wrap items-center gap-2">
            <RoleBadge role="student" verified />
            <RoleBadge role="resident" />
            <RoleBadge role="doctor" verified />
            <RoleBadge role="doctor" label="Cardiologist" verified />
            <RoleBadge role="official" />
            <Badge tone="accent">3</Badge>
            <Badge tone="brand">New</Badge>
            <Badge tone="success">Solved</Badge>
            <Badge tone="warning">Pending</Badge>
          </Demo>
          <Demo label="Avatars, online dot, group, hover card" className="flex flex-wrap items-center gap-4">
            <Avatar user={people[0]} size="xs" />
            <Avatar user={people[1]} size="sm" online />
            <Avatar user={people[2]} size="md" />
            <Avatar user={people[3]} size="lg" online />
            <AvatarGroup users={people} max={4} label="6 members" />
            <HoverCard
              card={
                <div>
                  <div className="flex items-center gap-3">
                    <Avatar user={people[0]} size="md" />
                    <div>
                      <p className="font-editorial text-lead font-medium text-ds-fg">{people[0].name}</p>
                      <RoleBadge role="doctor" label="Cardiologist" verified />
                    </div>
                  </div>
                  <p className="mt-3 text-meta text-ds-fg-2">Interventional cardiology · City General Hospital</p>
                  <p className="ds-num mt-2 text-meta text-ds-fg-3"><span className="font-medium text-ds-fg">1,284</span> followers · <span className="font-medium text-ds-fg">46</span> cases</p>
                </div>
              }
            >
              <button type="button" className="ds-focus rounded-ds-sm text-body font-medium text-ds-brand-text underline decoration-ds-line-strong underline-offset-4">Hover or focus me</button>
            </HoverCard>
          </Demo>
          <Demo label="Stats: big tabular numbers, hairline dividers, no boxes">
            <StatRow items={[{ label: 'Cases solved', value: '128' }, { label: 'Accuracy', value: '84%', hint: '96 polls' }, { label: 'Day streak', value: '12' }, { label: 'Followers', value: '1,284' }]} />
          </Demo>
          <Demo label="Progress" className="space-y-3">
            <Progress value={64} label="Profile 64% complete" />
            <Progress value={40} tone="accent" label="Daily goal" />
          </Demo>
        </Section>

        <Section id={`${theme}-surfaces`} title="Floating surfaces" intro="Glass only where something floats above content: menus, popovers, tooltips, toasts, sheets.">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setModal(true)}>Open dialog</Button>
            <Dropdown
              label="Post actions"
              trigger={<Button variant="outline" icon={MoreHorizontal}>Menu</Button>}
              items={[{ label: 'Edit post', icon: Pencil }, { label: 'Copy link', icon: Link2 }, 'divider', { label: 'Report', icon: Flag }, { label: 'Delete', icon: Trash2, danger: true }]}
            />
            <Popover label="Filters" trigger={<Button variant="outline" icon={Filter}>Filters</Button>}>
              <p className="font-editorial text-lead font-medium text-ds-fg">Filter cases</p>
              <div className="mt-3 space-y-3">
                <Checkbox label="Unsolved only" checked onChange={() => {}} />
                <Checkbox label="Has images" checked={false} onChange={() => {}} />
              </div>
            </Popover>
            <Tooltip content="Saved posts become flashcards">
              <IconButton icon={Bookmark} label="Save" variant="outline" />
            </Tooltip>
            <Button variant="ghost" onClick={() => toast('Saved to your Notebook')}>Show toast</Button>
          </div>
          <Demo label="Toasts" className="flex flex-col items-start gap-2">
            <Toast message="Saved to your Notebook" />
            <Toast message="Couldn't post. Check your connection." tone="danger" />
          </Demo>
          <Demo label="Floating create button (opens a menu)">
            <ComposeButton onPick={(k) => toast(`New ${k}`, 'info')} />
          </Demo>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title="Report this post"
            description="Our moderators review every report within a day."
            footer={
              <>
                <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
                <Button onClick={() => (setModal(false), toast('Thanks. We will take a look.'))}>Send report</Button>
              </>
            }
          >
            <div className="space-y-3">
              {['It identifies a patient', 'Misleading medical information', 'Spam or advertising', 'Something else'].map((r, i) => (
                <Radio key={r} name={`${theme}-report`} value={r} label={r} checked={i === 0} onChange={() => {}} />
              ))}
            </div>
          </Modal>
        </Section>

        <Section id={`${theme}-states`} title="Loading, empty, error" intro="Content loads as skeletons, never a spinner. Empty states give one line and one action.">
          <CardSkeleton />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Card>
            <EmptyState icon={Inbox} title="No saved cases yet" action={<Button size="sm" icon={Stethoscope}>Browse Case Rounds</Button>}>
              Save a case and it becomes a flashcard in your Notebook.
            </EmptyState>
          </Card>
          <Card>
            <ErrorState message="Couldn't load the feed." onRetry={() => toast('Retrying…', 'info')} />
          </Card>
        </Section>

        <Section id={`${theme}-cases`} title="Case card" intro="The most important component: specialty, serif title, presentation, image, meta and actions, with hierarchy from type rather than coloured boxes.">
          <CaseCard c={sampleCase} />
          <CaseCard c={caseWithImage} />
        </Section>

        <Section id={`${theme}-poll`} title="Diagnosis poll">
          <Card className="p-5 sm:p-6">
            <Poll options={['Inferior STEMI with RV infarction', 'Aortic dissection', 'Massive pulmonary embolism', 'Acute pericarditis']} correct={0} votes={[31, 6, 9, 2]} />
          </Card>
          <Card className="p-5 sm:p-6">
            <Poll options={['Pulmonary embolism', 'Pneumothorax', 'Pneumonia']} correct={0} votes={[40, 12, 8]} initialVote={1} />
          </Card>
        </Section>

        <Section id={`${theme}-thread`} title="Discussion thread">
          <Card className="p-5 sm:p-6">
            <CommentThread comments={thread} me={people[4]} />
          </Card>
        </Section>

        <Section id={`${theme}-chat`} title="Messages">
          <ChatView messages={chat} />
        </Section>

        <Section id={`${theme}-notifs`} title="Notifications">
          <Card className="p-2">
            <NotificationList groups={notifications} />
          </Card>
        </Section>

        <Section id={`${theme}-notebook`} title="Notebook">
          <NotebookSurface title="Right ventricular infarction" meta="Cardiology · saved from Case Rounds">
            <p>Suspect RV involvement in any <strong>inferior STEMI</strong> with hypotension, a raised JVP and clear lung fields.</p>
            <h3>Confirm</h3>
            <ul>
              <li>Right-sided leads: ST elevation ≥ 1 mm in <Vital>V4R</Vital></li>
              <li>Echo: dilated, hypokinetic right ventricle</li>
            </ul>
            <h3>Manage</h3>
            <p>Avoid nitrates and diuretics. Give fluids cautiously to support preload, and arrange urgent reperfusion.</p>
          </NotebookSurface>
        </Section>
      </div>
    </div>
  );
}

/**
 * /styleguide: every design-system component in light and dark. Not linked from the app; open it
 * directly. Wide screens show both themes side by side; phones switch between them.
 */
export default function Styleguide() {
  useDocumentTitle('Styleguide');
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches;
  const [view, setView] = useState(wide ? 'both' : 'light');

  useEffect(() => {
    let link = document.querySelector('link[data-ds-fonts]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      link.dataset.dsFonts = '';
      document.head.appendChild(link);
    }
  }, []);

  const panes = view === 'both' ? ['light', 'dark'] : [view];
  return (
    <DsTheme theme="light" className="ds-canvas min-h-dvh">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-ds-line bg-ds-surface px-4 py-3 sm:px-8">
        <div>
          <h1 className="font-editorial text-title font-medium text-ds-fg">Tectum design system</h1>
          <p className="text-meta text-ds-fg-3">Tokens, components and patterns · v2 draft for review</p>
        </div>
        <SegmentedControl
          label="Theme"
          size="sm"
          value={view}
          onChange={setView}
          items={[...(wide ? [{ value: 'both', label: 'Side by side' }] : []), { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        />
      </header>
      <div className={cn('grid', panes.length === 2 && 'xl:grid-cols-2')}>
        {panes.map((p) => (
          <DsTheme key={p} theme={p} className="ds-canvas min-w-0">
            <Library theme={p} />
          </DsTheme>
        ))}
      </div>
      <ToastViewport />
    </DsTheme>
  );
}
