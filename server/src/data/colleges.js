/**
 * Indian medical colleges Tectum knows the state of. Used by "Who to follow" (same college /
 * same state) and by the demo seed (scripts/seed-demo). [name, short name, state, region, tier, ownership]
 * tier: 'top' (national top institutes) or 'mid'. ownership: 'govt' or 'private'.
 * womenOnly colleges are marked separately.
 */
export const COLLEGES = [
  // north
  ['Lala Lajpat Rai Memorial Medical College, Meerut', 'LLRM Meerut', 'Uttar Pradesh', 'north', 'mid', 'govt'],
  ['Maharani Laxmi Bai Medical College, Jhansi', 'MLB Jhansi', 'Uttar Pradesh', 'north', 'mid', 'govt'],
  ['Baba Raghav Das Medical College, Gorakhpur', 'BRD Gorakhpur', 'Uttar Pradesh', 'north', 'mid', 'govt'],
  ['Rama Medical College, Kanpur', 'Rama Kanpur', 'Uttar Pradesh', 'north', 'mid', 'private'],
  ['Teerthanker Mahaveer Medical College, Moradabad', 'TMMC Moradabad', 'Uttar Pradesh', 'north', 'mid', 'private'],
  ['Government Medical College, Haldwani', 'GMC Haldwani', 'Uttarakhand', 'north', 'mid', 'govt'],
  ['Maharaja Agrasen Medical College, Agroha', 'MAMC Agroha', 'Haryana', 'north', 'mid', 'govt'],
  ['BPS Government Medical College for Women, Khanpur Kalan', 'BPSGMC Khanpur', 'Haryana', 'north', 'mid', 'govt'],
  ['Adesh Institute of Medical Sciences and Research, Bathinda', 'AIMSR Bathinda', 'Punjab', 'north', 'mid', 'private'],
  ['Dr. Rajendra Prasad Government Medical College, Tanda', 'RPGMC Tanda', 'Himachal Pradesh', 'north', 'mid', 'govt'],
  ['Acharya Shri Chander College of Medical Sciences, Jammu', 'ASCOMS Jammu', 'Jammu and Kashmir', 'north', 'mid', 'private'],
  // west / central
  ['Government Medical College, Kota', 'GMC Kota', 'Rajasthan', 'west', 'mid', 'govt'],
  ['Jhalawar Medical College, Jhalawar', 'JMC Jhalawar', 'Rajasthan', 'west', 'mid', 'govt'],
  ['Pacific Institute of Medical Sciences, Udaipur', 'PIMS Udaipur', 'Rajasthan', 'west', 'mid', 'private'],
  ['Government Medical College, Bhavnagar', 'GMC Bhavnagar', 'Gujarat', 'west', 'mid', 'govt'],
  ['GMERS Medical College, Gandhinagar', 'GMERS Gandhinagar', 'Gujarat', 'west', 'mid', 'govt'],
  ['Government Medical College, Akola', 'GMC Akola', 'Maharashtra', 'west', 'mid', 'govt'],
  ['Government Medical College, Latur', 'GMC Latur', 'Maharashtra', 'west', 'mid', 'govt'],
  ['Shri Vasantrao Naik Government Medical College, Yavatmal', 'SVNGMC Yavatmal', 'Maharashtra', 'west', 'mid', 'govt'],
  ['Dr. Panjabrao Deshmukh Memorial Medical College, Amravati', 'PDMMC Amravati', 'Maharashtra', 'west', 'mid', 'private'],
  ['Krishna Institute of Medical Sciences, Karad', 'KIMS Karad', 'Maharashtra', 'west', 'mid', 'private'],
  ['Shyam Shah Medical College, Rewa', 'SSMC Rewa', 'Madhya Pradesh', 'west', 'mid', 'govt'],
  ['Bundelkhand Medical College, Sagar', 'BMC Sagar', 'Madhya Pradesh', 'west', 'mid', 'govt'],
  ['Government Medical College, Rajnandgaon', 'GMC Rajnandgaon', 'Chhattisgarh', 'west', 'mid', 'govt'],
  // east / northeast
  ['Darbhanga Medical College, Darbhanga', 'DMCH Darbhanga', 'Bihar', 'east', 'mid', 'govt'],
  ['Nalanda Medical College, Patna', 'NMCH Patna', 'Bihar', 'east', 'mid', 'govt'],
  ['MGM Medical College, Jamshedpur', 'MGM Jamshedpur', 'Jharkhand', 'east', 'mid', 'govt'],
  ['MKCG Medical College, Berhampur', 'MKCG Berhampur', 'Odisha', 'east', 'mid', 'govt'],
  ['Hi-Tech Medical College, Bhubaneswar', 'Hi-Tech BBSR', 'Odisha', 'east', 'mid', 'private'],
  ['Bankura Sammilani Medical College, Bankura', 'BSMC Bankura', 'West Bengal', 'east', 'mid', 'govt'],
  ['North Bengal Medical College, Siliguri', 'NBMC Siliguri', 'West Bengal', 'east', 'mid', 'govt'],
  ['Silchar Medical College, Silchar', 'SMC Silchar', 'Assam', 'east', 'mid', 'govt'],
  ['Jorhat Medical College, Jorhat', 'JMCH Jorhat', 'Assam', 'east', 'mid', 'govt'],
  // south
  ['Kurnool Medical College, Kurnool', 'KMC Kurnool', 'Andhra Pradesh', 'south', 'mid', 'govt'],
  ['Rangaraya Medical College, Kakinada', 'RMC Kakinada', 'Andhra Pradesh', 'south', 'mid', 'govt'],
  ['Kakatiya Medical College, Warangal', 'KMC Warangal', 'Telangana', 'south', 'mid', 'govt'],
  ['Government Medical College, Nizamabad', 'GMC Nizamabad', 'Telangana', 'south', 'mid', 'govt'],
  ['Shimoga Institute of Medical Sciences, Shivamogga', 'SIMS Shivamogga', 'Karnataka', 'south', 'mid', 'govt'],
  ['Vijayanagar Institute of Medical Sciences, Ballari', 'VIMS Ballari', 'Karnataka', 'south', 'mid', 'govt'],
  ['KVG Medical College, Sullia', 'KVG Sullia', 'Karnataka', 'south', 'mid', 'private'],
  ['Government Mohan Kumaramangalam Medical College, Salem', 'GMKMC Salem', 'Tamil Nadu', 'south', 'mid', 'govt'],
  ['Sri Muthukumaran Medical College, Chennai', 'SMMCH Chennai', 'Tamil Nadu', 'south', 'mid', 'private'],
  ['Government Medical College, Thrissur', 'GMC Thrissur', 'Kerala', 'south', 'mid', 'govt'],
  ['Sree Gokulam Medical College, Thiruvananthapuram', 'SGMC Trivandrum', 'Kerala', 'south', 'mid', 'private'],
  // top-level
  ['AIIMS New Delhi', 'AIIMS Delhi', 'Delhi', 'north', 'top', 'govt'],
  ['Maulana Azad Medical College, New Delhi', 'MAMC Delhi', 'Delhi', 'north', 'top', 'govt'],
  ['Seth GS Medical College & KEM Hospital, Mumbai', 'GSMC-KEM Mumbai', 'Maharashtra', 'west', 'top', 'govt'],
  ['Madras Medical College, Chennai', 'MMC Chennai', 'Tamil Nadu', 'south', 'top', 'govt'],
  ['Bangalore Medical College and Research Institute', 'BMCRI Bengaluru', 'Karnataka', 'south', 'top', 'govt'],
  ['B.J. Government Medical College, Pune', 'BJGMC Pune', 'Maharashtra', 'west', 'top', 'govt'],
  ["King George's Medical University, Lucknow", 'KGMU Lucknow', 'Uttar Pradesh', 'north', 'top', 'govt'],
  ['Medical College, Kolkata', 'MCK Kolkata', 'West Bengal', 'east', 'top', 'govt'],
].map(([name, short, state, region, tier, ownership]) => ({
  name,
  short,
  state,
  region,
  tier,
  ownership,
  womenOnly: name.startsWith('BPS Government Medical College for Women'),
}));

const byName = new Map(COLLEGES.map((c) => [c.name.toLowerCase(), c]));

/** The state of a known college (exact name, any case), or '' for colleges not in the list. */
export const stateOfInstitution = (institution = '') => byName.get(String(institution).trim().toLowerCase())?.state ?? '';

/** Every known college in a state (for "same state" suggestions). */
export const collegesInState = (state) => COLLEGES.filter((c) => c.state === state).map((c) => c.name);
