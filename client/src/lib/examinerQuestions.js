/**
 * Practical / viva-style exam questions for the Home page "Examiner".
 * Educational revision content, kept to standard textbook teaching; always check local guidelines.
 */
export const EXAMINER_QUESTIONS = [
  {
    id: 'jvp',
    subject: 'Cardiology',
    q: 'How do you assess the jugular venous pressure (JVP), and what is normal?',
    a: 'Position the patient at 45° with the head turned slightly to the left, and look for the double-waved internal jugular pulsation between the heads of sternocleidomastoid. Measure the vertical height of the top of the pulsation above the sternal angle.',
    points: [
      'Normal: up to about 3 to 4 cm above the sternal angle',
      'Raised in right heart failure, fluid overload, tricuspid regurgitation, tamponade',
      'Raised and non-pulsatile: think superior vena cava obstruction',
      'Hepatojugular reflux can help confirm a borderline JVP',
    ],
  },
  {
    id: 'effusion',
    subject: 'Respiratory',
    q: 'What would you find on examination of a patient with a large pleural effusion?',
    a: 'On the affected side: reduced chest expansion, stony dull percussion note, and reduced or absent breath sounds and vocal resonance.',
    points: [
      'Trachea may be pushed away from a large effusion',
      'Bronchial breathing may be heard just above the fluid level',
      'Next step: chest X-ray, then ultrasound-guided diagnostic tap',
      'Light’s criteria separate exudate from transudate',
    ],
  },
  {
    id: 'facial',
    subject: 'Neurology',
    q: 'How do you differentiate an upper motor neuron from a lower motor neuron facial palsy?',
    a: 'Ask the patient to raise their eyebrows. In an UMN lesion the forehead is spared, because the upper face has bilateral cortical supply. In a LMN lesion (e.g. Bell’s palsy) the whole side of the face is weak, including the forehead.',
    points: [
      'UMN causes: stroke, tumour (lower face weak, forehead spared)',
      'LMN causes: Bell’s palsy, Ramsay Hunt, parotid tumour, trauma',
      'LMN: may be unable to close the eye; Bell’s phenomenon (eye rolls up)',
      'Check for vesicles in the ear (Ramsay Hunt) and other cranial nerves',
    ],
  },
  {
    id: 'shifting',
    subject: 'Gastroenterology',
    q: 'How do you elicit shifting dullness, and what does it indicate?',
    a: 'With the patient supine, percuss from the midline towards the flank until the note becomes dull. Keep your finger there, roll the patient onto the opposite side, wait about 30 seconds, and percuss again. If the dull area becomes resonant, shifting dullness is present.',
    points: [
      'Indicates free fluid in the peritoneal cavity (ascites)',
      'Needs a moderate volume of fluid to be detectable',
      'Fluid thrill is used for large, tense ascites',
      'Look for causes: signs of chronic liver disease, heart failure, malignancy',
    ],
  },
  {
    id: 'guedel',
    subject: 'Emergency Medicine',
    q: 'Spotter: an oropharyngeal (Guedel) airway. How do you size and insert it?',
    a: 'Size it from the incisors (or corner of the mouth) to the angle of the mandible. In adults, insert it upside down and rotate 180° as it passes the soft palate. In children, insert it the right way up, using a tongue depressor.',
    points: [
      'Only use in patients without a gag reflex',
      'Too small: pushes the tongue back; too large: can obstruct the larynx',
      'Nasopharyngeal airway is better tolerated if the gag reflex is present',
      'Avoid nasopharyngeal airways in suspected base-of-skull fracture',
    ],
  },
  {
    id: 'leopold',
    subject: 'Obstetrics',
    q: 'Name Leopold’s manoeuvres and what each one assesses.',
    a: 'Four abdominal grips used in late pregnancy to assess fetal lie, presentation and position.',
    points: [
      '1st, fundal grip: which fetal part is in the fundus',
      '2nd, lateral (umbilical) grip: position of the fetal back',
      '3rd, Pawlik’s grip: the presenting part and its mobility',
      '4th, pelvic grip: engagement and attitude of the head',
    ],
  },
  {
    id: 'dehydration',
    subject: 'Pediatrics',
    q: 'What are the WHO signs of severe dehydration in a child with diarrhoea?',
    a: 'Two or more of: lethargic or unconscious, sunken eyes, not able to drink or drinking poorly, and skin pinch goes back very slowly (more than 2 seconds).',
    points: [
      'Severe dehydration: WHO Plan C (rapid IV fluids)',
      'Some dehydration: Plan B (ORS over 4 hours)',
      'No dehydration: Plan A (fluids and zinc at home)',
      'Always check for danger signs and malnutrition',
    ],
  },
  {
    id: 'trendelenburg',
    subject: 'Orthopedics',
    q: 'What does the Trendelenburg test assess, and how is it interpreted?',
    a: 'It tests the hip abductors (gluteus medius and minimus). The patient stands on the affected leg. If the pelvis drops on the opposite, unsupported side, the test is positive.',
    points: [
      'Causes: weak abductors, superior gluteal nerve injury',
      'Hip pathology: osteoarthritis, developmental dysplasia, coxa vara',
      'Gait equivalent: Trendelenburg (waddling if bilateral) gait',
      'Compare both sides and watch for trunk lean as compensation',
    ],
  },
  {
    id: 'hyperk',
    subject: 'Cardiology',
    q: 'List the ECG changes of hyperkalaemia in order of severity.',
    a: 'Tall, peaked T waves; then flattened or absent P waves and a prolonged PR interval; then a widened QRS; progressing to a sine-wave pattern, ventricular fibrillation or asystole.',
    points: [
      'ECG changes mean urgent treatment',
      'IV calcium gluconate stabilises the cardiac membrane (does not lower K+)',
      'Insulin with dextrose and nebulised salbutamol shift K+ into cells',
      'Remove K+: stop culprit drugs, binders, dialysis if needed',
    ],
  },
  {
    id: 'lump',
    subject: 'Surgery',
    q: 'How do you describe a lump on examination?',
    a: 'Describe systematically: site, size, shape, surface, edge, colour, temperature, tenderness, consistency, fluctuation, transillumination, pulsatility, reducibility, and fixity to skin and deep structures.',
    points: [
      'Always examine the regional lymph nodes',
      'Transillumination: cystic lesions such as a hydrocele',
      'Hard, irregular, fixed lumps raise concern for malignancy',
      'Finish with the relevant system examination',
    ],
  },
  {
    id: 'gcs',
    subject: 'Neurology',
    q: 'What are the components of the Glasgow Coma Scale?',
    a: 'Eye opening (scored 1 to 4), verbal response (1 to 5) and motor response (1 to 6), giving a total from 3 to 15.',
    points: [
      'Record each component, e.g. E3 V4 M6 = 13',
      'GCS 8 or less: consider securing the airway',
      'Best motor response is the most useful predictor',
      'Use the paediatric GCS for young children',
    ],
  },
  {
    id: 'paradoxus',
    subject: 'Cardiology',
    q: 'What is pulsus paradoxus, and what causes it?',
    a: 'An exaggerated fall in systolic blood pressure of more than 10 mmHg during inspiration.',
    points: [
      'Classic cause: cardiac tamponade',
      'Also severe acute asthma and COPD exacerbation',
      'Less commonly constrictive pericarditis',
      'Tamponade: Beck’s triad of hypotension, raised JVP, muffled heart sounds',
    ],
  },
  {
    id: 'clubbing',
    subject: 'Respiratory',
    q: 'How do you check for finger clubbing, and name some causes.',
    a: 'Look for loss of the angle at the nail bed and increased nail-bed fluctuation. Schamroth’s window test: the diamond-shaped window between opposed nails is lost in clubbing.',
    points: [
      'Lung: bronchial carcinoma, bronchiectasis, interstitial lung disease, empyema',
      'Heart: cyanotic congenital heart disease, infective endocarditis',
      'Gut: inflammatory bowel disease, cirrhosis',
      'Not a feature of uncomplicated COPD or asthma',
    ],
  },
  {
    id: 'bls',
    subject: 'Emergency Medicine',
    q: 'What are the key numbers for high-quality adult chest compressions?',
    a: 'Rate 100 to 120 per minute, depth 5 to 6 cm, ratio 30 compressions to 2 breaths, allowing full chest recoil and minimising interruptions.',
    points: [
      'Hands on the centre of the chest (lower half of the sternum)',
      'Swap compressors about every 2 minutes to avoid fatigue',
      'Attach a defibrillator as soon as it is available',
      'Shockable rhythms: VF and pulseless VT',
    ],
  },
  {
    id: 'rapd',
    subject: 'Ophthalmology',
    q: 'How do you test for a relative afferent pupillary defect (RAPD)?',
    a: 'Swinging flashlight test: in a dim room, swing a bright light back and forth between the eyes. When the light moves to the affected eye, both pupils dilate instead of constricting.',
    points: [
      'Indicates optic nerve disease (e.g. optic neuritis) or severe retinal disease',
      'Also called a Marcus Gunn pupil',
      'Not caused by cataract or refractive error',
      'Check visual acuity, colour vision and fundi as well',
    ],
  },
  {
    id: 'target',
    subject: 'Hematology',
    q: 'Peripheral smear spotter: target cells. Where are they seen?',
    a: 'Target cells (codocytes) have a central dense spot within a pale ring, due to excess membrane relative to haemoglobin.',
    points: [
      'Thalassaemia',
      'Liver disease and obstructive jaundice',
      'Haemoglobin C disease',
      'Post-splenectomy',
    ],
  },
  {
    id: 'hernia',
    subject: 'Surgery',
    q: 'How do you clinically differentiate a direct from an indirect inguinal hernia?',
    a: 'Reduce the hernia, press over the deep inguinal ring (just above the midpoint of the inguinal ligament) and ask the patient to cough. If the hernia stays controlled, it is indirect. If it bulges medially, it is direct.',
    points: [
      'Indirect: passes through the deep ring, can descend into the scrotum',
      'Direct: through Hesselbach’s triangle, rarely enters the scrotum',
      'Anatomically confirmed at surgery: indirect lies lateral to the inferior epigastric vessels',
      'Indirect hernias are more likely to strangulate',
    ],
  },
  {
    id: 'nitrite',
    subject: 'Nephrology',
    q: 'A urine dipstick is nitrite positive. What does it suggest?',
    a: 'Presence of bacteria that reduce nitrate to nitrite, usually Gram-negative organisms such as E. coli. It supports a urinary tract infection, especially with positive leukocyte esterase.',
    points: [
      'False negatives: Enterococcus, Staphylococcus saprophyticus, dilute or fresh urine',
      'Send a midstream urine culture before antibiotics when indicated',
      'Asymptomatic bacteriuria is usually not treated, except in pregnancy',
      'Correlate with symptoms such as dysuria and frequency',
    ],
  },
  {
    id: 'milestones',
    subject: 'Pediatrics',
    q: 'At roughly what age does a child sit without support, walk alone, and use two-word phrases?',
    a: 'Sits without support at about 8 months, walks alone at about 12 to 15 months, and joins two words together at about 2 years.',
    points: [
      'Social smile: about 6 weeks',
      'Head control: about 3 to 4 months',
      'Red flag: not walking by 18 months',
      'Always correct for prematurity up to 2 years',
    ],
  },
  {
    id: 'thyroid',
    subject: 'Endocrinology',
    q: 'How do you examine a thyroid swelling, and what makes it move on swallowing?',
    a: 'Inspect from the front, ask the patient to swallow water, then palpate from behind. A thyroid swelling moves up on swallowing because the gland is attached to the larynx by the pretracheal fascia.',
    points: [
      'Thyroglossal cyst moves on tongue protrusion',
      'Check for retrosternal extension and tracheal deviation',
      'Examine for lymph nodes and a bruit',
      'Assess thyroid status: pulse, tremor, eye signs, reflexes',
    ],
  },
];

/** A stable daily pick of `n` questions; `offset` gives the next set for "New set". */
export function pickExaminerSet(n = 5, offset = 0, date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const total = EXAMINER_QUESTIONS.length;
  const start = ((day + offset) * n) % total;
  return Array.from({ length: n }, (_, i) => EXAMINER_QUESTIONS[(start + i) % total]);
}
