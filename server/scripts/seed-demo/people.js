import { CONFIG } from './config.js';
import { rng } from './rng.js';
import { COLLEGES } from '../../src/data/colleges.js';

/**
 * Name pools by community: first names common for people born around 2000-2006, with
 * surnames that go with them. region = where the names come from (for college matching).
 */
const COMMUNITIES = [
  {
    id: 'hindi', region: 'north', share: 1,
    surnames: ['Sharma', 'Verma', 'Gupta', 'Mishra', 'Tiwari', 'Chauhan', 'Agarwal', 'Saxena', 'Srivastava'],
    male: ['Aarav', 'Ishaan', 'Rohan', 'Aditya', 'Arjun', 'Varun', 'Siddharth', 'Kartik', 'Ayush', 'Harsh', 'Shivam', 'Utkarsh', 'Ankit', 'Saurabh', 'Yash', 'Akshat', 'Divyansh', 'Prakhar', 'Vaibhav', 'Anmol'],
    female: ['Ananya', 'Priya', 'Shruti', 'Riya', 'Pooja', 'Shreya', 'Aditi', 'Khushi', 'Muskan', 'Nidhi', 'Tanvi', 'Simran', 'Ishita', 'Vanshika', 'Akanksha', 'Sakshi', 'Anjali', 'Kritika'],
  },
  {
    id: 'marathi', region: 'west', share: 0.6,
    surnames: ['Patil', 'Deshmukh', 'Kulkarni', 'Joshi', 'Pawar', 'Jadhav'],
    male: ['Omkar', 'Aniket', 'Tejas', 'Pranav', 'Siddhesh', 'Atharva', 'Chinmay', 'Vedant', 'Rohan', 'Sahil', 'Kunal', 'Aditya'],
    female: ['Sneha', 'Rutuja', 'Sayali', 'Gauri', 'Mrunal', 'Janhavi', 'Prachi', 'Aishwarya', 'Shruti', 'Pooja', 'Isha', 'Mansi'],
  },
  {
    id: 'gujarati', region: 'west', share: 0.4,
    surnames: ['Patel', 'Shah', 'Desai', 'Joshi'],
    male: ['Dhruv', 'Parth', 'Jay', 'Meet', 'Hardik', 'Harsh', 'Yash', 'Kunal'],
    female: ['Dhwani', 'Riddhi', 'Khushi', 'Nidhi', 'Kavya', 'Isha', 'Mansi', 'Krupa'],
  },
  {
    id: 'tamil-malayali', region: 'south', share: 0.4,
    surnames: ['Iyer', 'Nair', 'Menon', 'Pillai'],
    male: ['Karthik', 'Vishnu', 'Gokul', 'Arvind', 'Adarsh', 'Varun', 'Sanjay', 'Abhinav'],
    female: ['Harini', 'Gayathri', 'Keerthana', 'Lakshmi', 'Nandini', 'Pavithra', 'Divya', 'Sruthi'],
  },
  {
    id: 'telugu', region: 'south', share: 0.35,
    surnames: ['Reddy', 'Rao', 'Naidu'],
    male: ['Sai Teja', 'Harsha', 'Nikhil', 'Akhil', 'Srikanth', 'Rahul', 'Abhinav', 'Rohit'],
    female: ['Meghana', 'Sowmya', 'Anusha', 'Swathi', 'Akhila', 'Divya', 'Deepika', 'Sneha'],
  },
  {
    id: 'kannada', region: 'south', share: 0.25,
    surnames: ['Hegde', 'Shetty', 'Rao'],
    male: ['Pranav', 'Karthik', 'Adarsh', 'Rohit', 'Nikhil', 'Varun'],
    female: ['Ananya', 'Kavya', 'Deepika', 'Meghana', 'Shreya', 'Aishwarya'],
  },
  {
    id: 'bengali', region: 'east', share: 0.5,
    surnames: ['Banerjee', 'Chatterjee', 'Mukherjee', 'Das', 'Ghosh'],
    male: ['Soham', 'Arnab', 'Aritra', 'Ayan', 'Sayan', 'Anirban', 'Sagnik', 'Sourav', 'Rishav'],
    female: ['Ankita', 'Moumita', 'Sohini', 'Trisha', 'Srijita', 'Madhurima', 'Rupsha', 'Shreya', 'Debanjali'],
  },
  {
    id: 'odia', region: 'east', share: 0.25,
    surnames: ['Mohanty', 'Das', 'Mishra'],
    male: ['Subham', 'Satyajit', 'Pritam', 'Swapnil', 'Abhishek', 'Ankit'],
    female: ['Subhashree', 'Smruti', 'Anwesha', 'Pallavi', 'Priyanka', 'Ipsita'],
  },
  {
    id: 'bihari', region: 'east', share: 0.25,
    surnames: ['Sinha', 'Mishra'],
    male: ['Abhishek', 'Rishav', 'Ankit', 'Saurabh', 'Aman', 'Shivam'],
    female: ['Priyanka', 'Ankita', 'Riya', 'Nidhi', 'Shreya', 'Kriti'],
  },
];

const YEAR_LABELS = {
  first: ['MBBS 1st Year', '1st Prof MBBS', 'MBBS 1st Prof', 'First Year MBBS'],
  second: ['MBBS 2nd Prof', '2nd Year MBBS', '2nd Prof MBBS', 'MBBS 2nd Year'],
  final: ['Final Year MBBS', 'MBBS Final Prof', 'Final Prof Part 2', 'Final Year MBBS'],
  intern: ['Intern', 'MBBS Intern', 'Intern | NEET-PG 2027', 'NEET-PG 2027 aspirant', 'Post-intern, NEET-PG 2027'],
};
const STUDY_YEAR = { first: '1', second: '2', final: 'final', intern: 'intern' };

const DREAMS = ['Ortho dreams', 'Future surgeon', 'Medicine > everything', 'Radiology someday', 'Paeds is the plan', 'Derm hopeful', 'Cardio dreams', 'OBG calling', 'Neuro nerd', 'Psych curious', 'ENT someday', 'Ophtho hopeful'];
const SUBJECT_LOVES = {
  first: ['Anatomy nerd', 'Physio > Anatomy, fight me', 'Biochem pathways at 2am', 'Brachial plexus is my personality', 'Embryology finally makes sense'],
  second: ['Pharma tables enthusiast', 'Path is life', 'Micro mnemonics hoarder', 'Robbins + chai', 'KDT on repeat'],
  final: ['Harrison + Bailey survivor', 'Ward rounds and case sheets', 'OBG postings are wild', 'Clinical cases > MCQs', 'Short cases, long nights'],
  intern: ['Casualty postings', 'PYQs daily', 'Grand tests every Sunday', 'Revision mode on', 'Marrow + PYQs'],
};
const BIO_EXTRAS = ["Making notes so you don't have to", 'Sharing what I revise', 'Mostly here for the cases', 'One pearl a day', 'Mnemonics > memory', 'Corrections welcome', 'Learning in public', 'Chai-powered'];

const STYLES = ['bullets', 'dashes', 'arrows', 'numbered', 'compact'];
const TIME_PATTERNS = Object.keys(CONFIG.TIME_PATTERNS);

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

/** A handle in one of several styles: ananya.iyer, rohan_patil_mbbs, kavya27, karthik.r, dr.sneha_to_be ... */
function makeHandle(r, first, last, year) {
  const f = slug(first);
  const l = slug(last);
  const styles = [
    () => `${f}.${l}`,
    () => `${f}_${l}_mbbs`,
    () => `${f}${r.int(0, 6) ? r.int(1, 30) : r.int(0, 6).toString().padStart(2, '0')}`,
    () => `${f}.${l[0]}`,
    () => (year === 'intern' ? `dr.${f}.${l}` : `dr.${f}_to_be`),
    () => `${f}${l}`,
    () => `${l}.${f}`,
    () => `${f}_${l[0]}${r.int(1, 9)}`,
    () => `${f}.${l}.med`,
  ];
  return r.pick(styles)();
}

function makeBio(r, year, college, studyLabel) {
  if (r.chance(CONFIG.BIO_EMPTY_SHARE)) return '';
  const parts = [];
  const shape = r.int(0, 5);
  if (shape === 0) parts.push(studyLabel, college.short, r.pick(DREAMS));
  else if (shape === 1) parts.push(r.pick(SUBJECT_LOVES[year]));
  else if (shape === 2) parts.push(`${studyLabel} @ ${college.short}`, r.pick(BIO_EXTRAS));
  else if (shape === 3) parts.push(year === 'final' || year === 'intern' ? `NEET-PG ${year === 'final' ? r.pick(['2027', '2028']) : '2027'} target` : r.pick(SUBJECT_LOVES[year]), r.pick(DREAMS));
  else if (shape === 4) parts.push(r.pick(BIO_EXTRAS));
  else parts.push(college.short, r.pick(SUBJECT_LOVES[year]), r.pick(BIO_EXTRAS));
  const sep = r.pick([' | ', ' · ', '. ']);
  return parts.join(sep).slice(0, 160);
}

/**
 * The demo accounts, always the same for the same CONFIG.SEED. Each has: n, email, name, gender,
 * username, institution (college object), year, studyYear, yearLabel, bio, joinedAt, style,
 * informal, timePattern, tier, weight, likerWeight.
 */
export function makePeople(now = new Date()) {
  const r = rng(`${CONFIG.SEED}:people`);
  const years = Object.entries(CONFIG.YEAR_SPLIT).flatMap(([y, n]) => Array(n).fill(y));
  if (years.length !== CONFIG.ACCOUNT_COUNT) throw new Error('CONFIG.YEAR_SPLIT must add up to ACCOUNT_COUNT');
  const yearsShuffled = r.shuffle(years);

  // Regions by share, then genders alternating within each so it's ~50/50 overall.
  const regionList = Object.entries(CONFIG.REGION_SPLIT);
  const usedNames = new Set();
  const usedHandles = new Set();
  const collegeUse = new Map();
  let topUsed = 0;
  const midColleges = COLLEGES.filter((c) => c.tier === 'mid');
  const topColleges = r.shuffle(COLLEGES.filter((c) => c.tier === 'top'));

  // Which account indexes get a top-level college: spread out, never the most active (see tiers).
  const topSlots = new Set(r.shuffle([...Array(CONFIG.ACCOUNT_COUNT).keys()]).slice(0, CONFIG.MAX_TOP_COLLEGE_ACCOUNTS));

  const people = [];
  for (let i = 0; i < CONFIG.ACCOUNT_COUNT; i += 1) {
    const year = yearsShuffled[i];
    const gender = i % 2 === 0 ? 'female' : 'male';
    const region = r.weighted(regionList, ([, share]) => share)[0];
    const community = r.weighted(COMMUNITIES.filter((c) => c.region === region), (c) => c.share);

    let first;
    let last;
    for (let tries = 0; tries < 200; tries += 1) {
      first = r.pick(community[gender]);
      last = r.pick(community.surnames);
      if (!usedNames.has(`${first} ${last}`)) break;
    }
    usedNames.add(`${first} ${last}`);

    // College: a top-level one for the chosen slots (max 1 each), otherwise mid-level, ~80% in
    // their own region, at most MAX_PER_MID_COLLEGE each, women's college only for women.
    let college;
    if (topSlots.has(i) && topUsed < Math.min(CONFIG.MAX_TOP_COLLEGE_ACCOUNTS, topColleges.length)) {
      college = topColleges[topUsed];
      topUsed += 1;
    } else {
      const home = r.chance(CONFIG.SAME_REGION_COLLEGE);
      const fits = (c) => (collegeUse.get(c.name) ?? 0) < CONFIG.MAX_PER_MID_COLLEGE && (!c.womenOnly || gender === 'female');
      let pool = midColleges.filter((c) => fits(c) && (home ? c.region === region : c.region !== region));
      if (!pool.length) pool = midColleges.filter(fits);
      // Prefer colleges with fewer students so far, so they spread across the list.
      college = r.weighted(pool, (c) => 1 / (1 + (collegeUse.get(c.name) ?? 0)) ** 2);
    }
    collegeUse.set(college.name, (collegeUse.get(college.name) ?? 0) + 1);

    let username = makeHandle(r, first, last, year);
    while (usedHandles.has(username)) username = `${username.replace(/\d+$/, '')}${r.int(2, 99)}`;
    usedHandles.add(username);

    const yearLabel = r.pick(YEAR_LABELS[year]);
    const joinedDaysAgo = r.range(...CONFIG.JOINED_DAYS_AGO);
    people.push({
      n: i + 1,
      email: CONFIG.EMAIL_PATTERN(i + 1),
      name: `${first} ${last}`,
      first,
      last,
      gender,
      region,
      community: community.id,
      username,
      college,
      year,
      studyYear: STUDY_YEAR[year],
      yearLabel,
      bio: makeBio(r, year, college, yearLabel),
      joinedAt: new Date(now.getTime() - joinedDaysAgo * 86400000),
      style: r.pick(STYLES),
      informal: r.chance(0.35),
      timePattern: r.pick(TIME_PATTERNS),
      likerWeight: r.range(...CONFIG.LIKER_WEIGHTS) ** 1.5,
    });
  }

  // Activity tiers: top-level college accounts are never 'power' (they stay normal).
  const order = r.shuffle(people);
  const nonTop = order.filter((p) => p.college.tier !== 'top');
  const top = order.filter((p) => p.college.tier === 'top');
  // Power accounts come from different years, so they don't compete for the same Wards.
  const powerCount = CONFIG.ACTIVITY_TIERS[0].count;
  const yearsInTurn = ['intern', 'final', 'second', 'first'];
  const power = [];
  for (let i = 0; power.length < powerCount && i < powerCount * 4; i += 1) {
    const year = yearsInTurn[i % yearsInTurn.length];
    const pick = nonTop.find((p) => p.year === year && !power.includes(p));
    if (pick) power.push(pick);
  }
  const queue = [...power, ...nonTop.filter((p) => !power.includes(p)), ...top]; // top-college ones land in the later (lower) tiers
  let k = 0;
  for (const tier of CONFIG.ACTIVITY_TIERS) {
    for (let j = 0; j < tier.count && k < queue.length; j += 1, k += 1) {
      queue[k].tier = tier.name;
      queue[k].weight = tier.weight;
    }
  }
  // Top-college accounts that fell into 'quiet' move up to 'regular' ("normal activity").
  for (const p of top) {
    if (p.tier === 'quiet' || p.tier === 'power') {
      const regular = CONFIG.ACTIVITY_TIERS.find((t) => t.name === 'regular');
      p.tier = regular.name;
      p.weight = regular.weight;
    }
  }
  return people;
}
