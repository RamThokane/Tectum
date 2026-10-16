/**
 * Built-in medical tag library for the Tags box's autocomplete, so members pick the same
 * spelling and posts are easy to find. Tags are lowercase with hyphens (as they're stored).
 */
const GROUPS = {
  // Subjects and specialties
  subjects: `anatomy physiology biochemistry pathology pharmacology microbiology forensic-medicine community-medicine psm
    internal-medicine general-medicine cardiology neurology pulmonology gastroenterology hepatology nephrology urology
    endocrinology hematology oncology medical-oncology radiation-oncology infectious-disease rheumatology immunology allergy
    emergency-medicine critical-care surgery general-surgery cardiothoracic-surgery neurosurgery plastic-surgery vascular-surgery
    pediatric-surgery orthopedics sports-medicine pediatrics neonatology obgyn obstetrics gynecology psychiatry dermatology
    venereology radiology interventional-radiology nuclear-medicine anesthesiology pain-medicine ophthalmology ent
    family-medicine geriatrics palliative-care public-health epidemiology biostatistics genetics histology embryology
    neuroanatomy dentistry nursing physiotherapy nutrition toxicology transfusion-medicine research medical-education ethics`,

  // Exams, study and careers
  study: `neet-pg neet-ss inicet fmge usmle usmle-step-1 usmle-step-2 plab mrcp mrcs mbbs md ms dnb internship residency
    mcq mcqs high-yield mnemonics one-liners pyq previous-year-questions revision notes flashcards clinical-pearls case-discussion
    viva ospe osce practicals long-case short-case spotters image-based-questions exam-tips study-tips time-table books`,

  // Cardiovascular
  cardio: `ecg echo hypertension heart-failure myocardial-infarction stemi nstemi acute-coronary-syndrome angina
    atrial-fibrillation atrial-flutter svt avnrt ventricular-tachycardia ventricular-fibrillation heart-block bradycardia
    cardiomyopathy myocarditis pericarditis cardiac-tamponade endocarditis rheumatic-heart-disease valvular-heart-disease
    mitral-stenosis mitral-regurgitation aortic-stenosis aortic-regurgitation congenital-heart-disease vsd asd pda tetralogy-of-fallot
    aortic-dissection aortic-aneurysm dvt pulmonary-embolism peripheral-artery-disease dyslipidemia cardiac-arrest acls bls cpr
    murmurs jvp heart-sounds shock cardiogenic-shock`,

  // Respiratory
  resp: `asthma copd pneumonia community-acquired-pneumonia tuberculosis mdr-tb pleural-effusion pneumothorax empyema ards
    bronchiectasis interstitial-lung-disease pulmonary-fibrosis lung-cancer sarcoidosis cystic-fibrosis sleep-apnea
    respiratory-failure abg spirometry pft chest-x-ray ventilation mechanical-ventilation oxygen-therapy covid-19 influenza`,

  // Gastro and liver
  gi: `gerd peptic-ulcer h-pylori gi-bleed upper-gi-bleed lower-gi-bleed cirrhosis hepatitis hepatitis-b hepatitis-c
    fatty-liver nafld alcoholic-liver-disease liver-failure portal-hypertension ascites hepatic-encephalopathy jaundice
    gallstones cholecystitis cholangitis pancreatitis ibd crohns-disease ulcerative-colitis ibs celiac-disease appendicitis
    intestinal-obstruction hernia colorectal-cancer gastric-cancer esophageal-cancer diarrhea constipation dysphagia lft`,

  // Kidney, fluids and electrolytes
  renal: `aki ckd dialysis nephrotic-syndrome nephritic-syndrome glomerulonephritis uti pyelonephritis kidney-stones
    renal-tubular-acidosis electrolytes hyponatremia hypernatremia hyperkalemia hypokalemia hypercalcemia hypocalcemia
    acid-base metabolic-acidosis metabolic-alkalosis respiratory-acidosis anion-gap fluids iv-fluids rft bph prostate-cancer`,

  // Endocrine and metabolic
  endo: `diabetes type-1-diabetes type-2-diabetes dka hhs hypoglycemia insulin thyroid hypothyroidism hyperthyroidism graves-disease
    thyroid-storm thyroid-cancer goitre cushings-syndrome addisons-disease adrenal-crisis pheochromocytoma hyperaldosteronism
    pcos obesity metabolic-syndrome osteoporosis hyperparathyroidism pituitary acromegaly prolactinoma diabetes-insipidus siadh
    gout vitamin-d-deficiency`,

  // Blood and cancer
  heme: `anemia iron-deficiency-anemia megaloblastic-anemia b12-deficiency hemolytic-anemia sickle-cell-disease thalassemia
    g6pd-deficiency aplastic-anemia leukemia aml all cml cll lymphoma hodgkin-lymphoma non-hodgkin-lymphoma multiple-myeloma
    itp ttp dic hemophilia von-willebrand-disease thrombocytopenia coagulation anticoagulation blood-transfusion cbc
    peripheral-smear breast-cancer cervical-cancer oral-cancer chemotherapy immunotherapy tumor-markers oncologic-emergencies`,

  // Infections
  infect: `sepsis septic-shock fever pyrexia-of-unknown-origin malaria dengue typhoid leptospirosis scrub-typhus chikungunya
    hiv aids syphilis gonorrhea sexually-transmitted-infections meningitis encephalitis cellulitis osteomyelitis rabies tetanus
    cholera leprosy filariasis kala-azar amoebiasis helminths fungal-infections candidiasis mucormycosis antibiotics
    antimicrobial-resistance vaccination immunization hospital-acquired-infections infection-control`,

  // Neuro and psych
  neuro: `stroke ischemic-stroke hemorrhagic-stroke tia subarachnoid-hemorrhage epilepsy seizures status-epilepticus headache
    migraine parkinsons-disease dementia alzheimers-disease multiple-sclerosis guillain-barre-syndrome myasthenia-gravis
    peripheral-neuropathy spinal-cord-injury head-injury traumatic-brain-injury raised-icp coma gcs cranial-nerves
    brain-tumor neuro-examination depression anxiety bipolar-disorder schizophrenia psychosis ocd ptsd adhd autism
    substance-abuse alcohol-withdrawal delirium suicide-prevention eating-disorders sleep-disorders`,

  // Women and children
  obped: `pregnancy antenatal-care labour normal-delivery cesarean-section preeclampsia eclampsia gestational-diabetes
    postpartum-hemorrhage ectopic-pregnancy abortion placenta-previa abruptio-placentae preterm-labour infertility
    contraception menstrual-disorders amenorrhea endometriosis fibroids ovarian-cancer menopause neonatal-jaundice
    neonatal-resuscitation growth-and-development milestones malnutrition sam vaccination-schedule kawasaki-disease
    bronchiolitis croup febrile-seizures diarrhea-in-children dehydration pediatric-emergencies congenital-anomalies`,

  // Surgery, trauma and bones
  surg: `trauma atls polytrauma burns wound-healing sutures surgical-instruments preoperative-care postoperative-care
    acute-abdomen peritonitis breast-lump thyroid-swelling varicose-veins fractures dislocations bone-tumors osteoarthritis
    rheumatoid-arthritis sle ankylosing-spondylitis back-pain spine carpal-tunnel-syndrome plaster-and-splints amputation
    laparoscopy minimally-invasive-surgery transplant`,

  // Skin, eye, ENT
  special: `acne psoriasis eczema dermatitis urticaria vitiligo scabies fungal-skin-infections skin-cancer melanoma hair-loss
    cataract glaucoma diabetic-retinopathy conjunctivitis red-eye refractive-errors retinal-detachment uveitis squint
    otitis-media hearing-loss vertigo sinusitis tonsillitis epistaxis nasal-polyps head-and-neck-cancer tracheostomy`,

  // Investigations and imaging
  tests: `investigations lab-values abg-interpretation ecg-interpretation x-ray ct-scan mri ultrasound pocus usg doppler
    biopsy histopathology cytology blood-culture urine-analysis csf-analysis pet-scan mammography endoscopy colonoscopy
    bronchoscopy echocardiography eeg emg nerve-conduction genetic-testing tumor-markers`,

  // Drugs and therapeutics
  drugs: `pharmacokinetics pharmacodynamics adverse-drug-reactions drug-interactions antihypertensives beta-blockers
    ace-inhibitors arbs calcium-channel-blockers diuretics statins antiplatelets aspirin clopidogrel heparin warfarin doacs
    thrombolysis nitrates digoxin amiodarone adenosine antiarrhythmics insulin-therapy metformin sglt2-inhibitors
    glp-1-agonists steroids corticosteroids nsaids opioids analgesics antiepileptics antidepressants antipsychotics
    benzodiazepines anesthetic-agents muscle-relaxants antibiotics-guide penicillins cephalosporins carbapenems
    fluoroquinolones macrolides aminoglycosides vancomycin antifungals antivirals antiretroviral-therapy antimalarials
    anti-tb-drugs vaccines immunosuppressants biologics chemotherapy-drugs antidotes emergency-drugs prescribing`,

  // Procedures and skills
  skills: `clinical-skills history-taking clinical-examination procedures iv-cannulation catheterization ng-tube intubation
    airway-management central-line lumbar-puncture arterial-blood-gas thoracentesis paracentesis chest-drain suturing
    injection-techniques blood-sampling triage resuscitation defibrillation communication-skills breaking-bad-news
    informed-consent documentation handover patient-safety`,

  // Foundations
  basics: `cell-biology genetics-basics molecular-biology enzymes metabolism vitamins minerals hormones acid-base-physiology
    cardiac-physiology renal-physiology respiratory-physiology neurophysiology muscle-physiology blood-physiology
    immunology-basics inflammation neoplasia hemodynamics cell-injury bacteriology virology parasitology mycology
    upper-limb lower-limb thorax abdomen pelvis head-and-neck brain spinal-cord blood-supply nerve-supply surface-anatomy
    osteology`,
};

const DISPLAY = {
  ent: 'ENT', obgyn: 'OBGYN', psm: 'PSM', mbbs: 'MBBS', md: 'MD', ms: 'MS', dnb: 'DNB', mcq: 'MCQ', mcqs: 'MCQs', pyq: 'PYQ',
  ecg: 'ECG', copd: 'COPD', ards: 'ARDS', aki: 'AKI', ckd: 'CKD', dka: 'DKA', hhs: 'HHS', uti: 'UTI', ibd: 'IBD', ibs: 'IBS',
  gerd: 'GERD', nafld: 'NAFLD', lft: 'LFT', rft: 'RFT', bph: 'BPH', pcos: 'PCOS', siadh: 'SIADH', aml: 'AML', all: 'ALL',
  cml: 'CML', cll: 'CLL', itp: 'ITP', ttp: 'TTP', dic: 'DIC', cbc: 'CBC', hiv: 'HIV', aids: 'AIDS', tia: 'TIA', gcs: 'GCS',
  ocd: 'OCD', ptsd: 'PTSD', adhd: 'ADHD', sam: 'SAM', atls: 'ATLS', sle: 'SLE', abg: 'ABG', pft: 'PFT', mri: 'MRI', usg: 'USG',
  eeg: 'EEG', emg: 'EMG', pocus: 'POCUS', arbs: 'ARBs', doacs: 'DOACs', nsaids: 'NSAIDs', acls: 'ACLS', bls: 'BLS', cpr: 'CPR',
  svt: 'SVT', avnrt: 'AVNRT', vsd: 'VSD', asd: 'ASD', pda: 'PDA', dvt: 'DVT', stemi: 'STEMI', nstemi: 'NSTEMI', ospe: 'OSPE',
  osce: 'OSCE', fmge: 'FMGE', plab: 'PLAB', mrcp: 'MRCP', mrcs: 'MRCS', inicet: 'INICET', jvp: 'JVP',
};

/** Every built-in tag, de-duplicated. */
export const MEDICAL_TAGS = [...new Set(Object.values(GROUPS).join(' ').split(/\s+/).filter(Boolean))];

/** How a tag reads to people: "heart-failure" → "Heart failure", "ecg" → "ECG". */
export const tagLabel = (t) =>
  DISPLAY[t] ??
  t
    .split('-')
    .map((w, i) => DISPLAY[w] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

/**
 * Tags matching what's been typed, best first: starts with it, then a word inside starts with it
 * ("failure" finds heart-failure), then contains it. `extra` (tags already used on Tectum, with
 * counts) are merged in and win ties.
 */
export function suggestTags(query, { exclude = [], extra = [], limit = 8 } = {}) {
  const q = query.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
  if (!q) return [];
  const used = new Map(extra.map((e) => [e.tag, e.posts]));
  const pool = [...new Set([...used.keys(), ...MEDICAL_TAGS])].filter((t) => !exclude.includes(t));
  const rank = (t) => {
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if (t.split('-').some((w) => w.startsWith(q))) return 2;
    if (t.includes(q)) return 3;
    return 9;
  };
  return pool
    .map((t) => ({ tag: t, r: rank(t), posts: used.get(t) ?? 0 }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || b.posts - a.posts || a.tag.length - b.tag.length || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
