/**
 * Reference notes for the "Trending in medicine worldwide" subjects on Discovery.
 *
 * These are short educational summaries written for Tectum, not live news, and not medical
 * advice. Every topic links out to WHO / PubMed for the full, current picture.
 */

export const TOPIC_GROUPS = [
  {
    group: 'Technology & AI',
    topics: [
      {
        label: 'Artificial intelligence in diagnosis',
        wiki: 'Artificial_intelligence_in_healthcare',
        summary:
          'Software trained on large sets of images, waveforms and records that flags findings or suggests diagnoses. It is used most in radiology, pathology, ophthalmology, dermatology and ECG interpretation.',
        points: [
          'Strongest evidence is in pattern-heavy tasks: screening mammography, diabetic retinopathy, lung nodules, arrhythmia detection.',
          'Models are assistive: a clinician remains responsible for the diagnosis and the record.',
          'Performance often drops on patients and scanners unlike the training data, so local validation matters.',
          'Regulators (FDA, EU MDR, CDSCO) now treat many of these tools as medical devices.',
        ],
        why: 'Large language models moved AI from research into everyday documentation and triage, which raised fresh questions about accuracy, liability and bias.',
      },
      {
        label: 'Telemedicine',
        wiki: 'Telehealth',
        summary:
          'Consultation and follow-up at a distance by video, phone or messaging, including remote prescribing and specialist support for rural centres.',
        points: [
          'Works well for follow-up, mental health, dermatology triage and chronic disease review.',
          'Weakest where examination or procedures are needed, and where connectivity is poor.',
          'Raises questions of licensing across states or countries, record keeping and consent.',
          'Hub-and-spoke tele-ICU and tele-stroke services extend scarce specialists to district hospitals.',
        ],
        why: 'Services scaled up during COVID-19 and largely stayed, so countries are now writing permanent rules and payment models.',
      },
      {
        label: 'Wearables and remote monitoring',
        wiki: 'Wearable_technology',
        summary:
          'Watches, patches, cuffs and implanted sensors that record heart rhythm, oxygen saturation, glucose, sleep or activity between visits.',
        points: [
          'Continuous glucose monitoring has changed day-to-day diabetes care the most.',
          'Consumer ECG features detect atrial fibrillation but also produce false alarms and incidental findings.',
          'Remote monitoring after heart failure or surgery can cut readmissions when someone is assigned to act on alerts.',
          'Data volume, alert fatigue and privacy are the main practical limits.',
        ],
        why: 'Sensors are now cheap and mainstream, so health systems are deciding which readings are worth acting on.',
      },
      {
        label: 'Robotic surgery',
        wiki: 'Robot-assisted_surgery',
        summary:
          'Minimally invasive operating with instruments controlled from a console, giving magnified 3D vision and wristed movement in narrow spaces.',
        points: [
          'Most established in urology (prostatectomy), gynaecology, colorectal and some thoracic work.',
          'Benefits are mainly less blood loss and shorter stay; long-term cancer outcomes are broadly similar to good laparoscopy.',
          'High capital and consumable costs concentrate it in larger centres.',
          'Training, credentialing and case volume strongly affect results.',
        ],
        why: 'Patents expiring and new entrants are lowering prices, which is spreading robotic programmes to more countries.',
      },
      {
        label: 'Point-of-care ultrasound',
        wiki: 'Point-of-care_ultrasound',
        summary:
          'Focused bedside scanning done by the treating clinician to answer a specific question: free fluid, effusion, hydronephrosis, lung B-lines, IVC filling, early pregnancy.',
        points: [
          'Protocols such as FAST, RUSH and BLUE structure the scan around a decision.',
          'Handheld probes plugged into a phone have brought it to clinics and ambulances.',
          'It supplements, and does not replace, formal departmental imaging.',
          'Quality depends on operator training and saved images for review.',
        ],
        why: 'Cheap handheld devices and strong emergency and critical care evidence have made it a core skill in training programmes.',
      },
      {
        label: 'Digital health records',
        wiki: 'Electronic_health_record',
        summary:
          'Electronic records that hold notes, results, prescriptions and images, ideally shared across the hospitals and clinics a patient uses.',
        points: [
          'Interoperability standards, chiefly HL7 FHIR, let separate systems exchange data.',
          'National digital health identifiers (for example India\'s ABDM) aim to link records across providers.',
          'Documentation burden is a leading cause of clinician burnout.',
          'Consent, access logs and breach response are core to trust.',
        ],
        why: 'Countries are building national exchanges, and the same records now feed AI tools, raising fresh consent questions.',
      },
      {
        label: '3D printing in medicine',
        wiki: '3D_printing',
        summary:
          'Printing patient-specific models, surgical guides, implants and prosthetics from CT or MRI data, and printing tissue scaffolds in research.',
        points: [
          'Anatomical models improve planning and consent in complex reconstructive and cardiac cases.',
          'Custom cranial, maxillofacial and orthopaedic implants are in routine use.',
          'Low-cost prosthetics extend access in low-resource settings.',
          'Bioprinted functioning organs remain experimental.',
        ],
        why: 'Printing has moved from novelty to planned surgical workflow in many large centres.',
      },
    ],
  },
  {
    group: 'Infectious disease',
    topics: [
      {
        label: 'Antimicrobial resistance',
        wiki: 'Antimicrobial_resistance',
        summary:
          'Bacteria, fungi, viruses and parasites evolving so that standard drugs stop working, leaving infections harder, costlier or impossible to treat.',
        points: [
          'Drivers include over-prescription, over-the-counter sales, incomplete courses, and heavy use in agriculture.',
          'Gram-negative organisms (carbapenem-resistant Klebsiella, Acinetobacter, E. coli) are the most pressing hospital threat.',
          'Drug-resistant tuberculosis and resistant gonorrhoea are major public health concerns.',
          'Stewardship, infection control, clean water, vaccination and diagnostics all reduce pressure.',
        ],
        why: 'WHO ranks it among the top global health threats, and the antibiotic pipeline remains thin because new agents are commercially unattractive.',
      },
      {
        label: 'Tuberculosis',
        wiki: 'Tuberculosis',
        summary:
          'A chronic bacterial infection, usually of the lungs, spread by airborne droplets; one of the world\'s deadliest infectious diseases, concentrated in South and South-East Asia and Africa.',
        points: [
          'Rapid molecular tests (Xpert MTB/RIF) detect TB and rifampicin resistance in hours.',
          'Shorter, all-oral regimens (including BPaLM) have transformed drug-resistant TB treatment.',
          'Latent infection can be treated with shorter rifapentine-based courses.',
          'Undernutrition, diabetes, HIV, smoking and crowding raise risk.',
        ],
        why: 'Services disrupted by COVID-19 set case-finding back, and countries are pushing to regain ground against elimination targets.',
      },
      {
        label: 'Malaria',
        wiki: 'Malaria',
        summary:
          'Parasitic infection spread by Anopheles mosquitoes, causing fever and, with P. falciparum, severe anaemia, cerebral malaria and death, mostly in African children.',
        points: [
          'Vaccines RTS,S/AS01 and R21/Matrix-M are being rolled out in endemic African countries.',
          'Artemisinin-based combination therapy remains first-line; partial artemisinin resistance is a growing worry.',
          'Insecticide-treated nets and indoor spraying still prevent most cases; insecticide resistance erodes their effect.',
          'Diagnosis should be confirmed by rapid test or microscopy before treatment.',
        ],
        why: 'Vaccine rollout at scale, plus the spread of resistant parasites and invasive urban mosquito species, are reshaping control programmes.',
      },
      {
        label: 'Dengue',
        wiki: 'Dengue_fever',
        summary:
          'Mosquito-borne viral illness with four serotypes, causing high fever, severe body ache and, in a minority, plasma leakage and shock.',
        points: [
          'Warning signs — persistent vomiting, abdominal pain, bleeding, lethargy, rising haematocrit with falling platelets — mark the critical phase.',
          'Careful fluid management, not platelet transfusion, is the mainstay of severe cases.',
          'Second infection with a different serotype carries higher severe-disease risk.',
          'Vector control and community clean-up remain the main prevention.',
        ],
        why: 'Outbreaks have spread to new latitudes and altitudes with warming and urbanisation, and newer vaccines are entering programmes.',
      },
      {
        label: 'HIV',
        wiki: 'HIV/AIDS',
        summary:
          'A retrovirus that depletes CD4 cells; with antiretroviral therapy it is now a manageable chronic condition with near-normal life expectancy.',
        points: [
          'Treatment as prevention: sustained undetectable viral load means the virus is not transmitted sexually.',
          'Pre-exposure prophylaxis, including long-acting injectables, protects those at high risk.',
          'Late diagnosis and drug stock-outs remain the main causes of death.',
          'Co-infection with TB, hepatitis and cryptococcal disease drives mortality.',
        ],
        why: 'Long-acting injectable prevention and treatment are changing programme design, while funding pressure threatens supply.',
      },
      {
        label: 'Hepatitis',
        wiki: 'Viral_hepatitis',
        summary:
          'Liver inflammation from viruses A to E; B and C cause chronic infection leading to cirrhosis and liver cancer.',
        points: [
          'Hepatitis C is curable in most people with 8–12 weeks of direct-acting antivirals.',
          'Hepatitis B is preventable by vaccination, including a birth dose, and controllable with antivirals.',
          'Most people with chronic B or C are undiagnosed, so screening is the bottleneck.',
          'Hepatitis A and E spread through contaminated food and water; E is dangerous in pregnancy.',
        ],
        why: 'Elimination targets have made testing and treatment scale-up a priority, especially where cure is available but unused.',
      },
      {
        label: 'Vaccines and immunisation',
        wiki: 'Vaccination',
        summary:
          'Training immunity in advance to prevent disease; the most cost-effective public health tool after clean water.',
        points: [
          'Routine childhood schedules prevent measles, polio, diphtheria, pertussis, tetanus, Hib, pneumococcus, rotavirus and hepatitis B.',
          'HPV vaccination is central to cervical cancer elimination plans.',
          'mRNA platforms allow rapid redesign against new variants and are being tried in other diseases.',
          'Coverage gaps ("zero-dose" children) drive measles and diphtheria outbreaks.',
        ],
        why: 'Post-pandemic coverage dips and organised misinformation have brought preventable outbreaks back to countries that had controlled them.',
      },
      {
        label: 'Long COVID',
        wiki: 'Long_COVID',
        summary:
          'Symptoms continuing or appearing weeks after SARS-CoV-2 infection: fatigue, breathlessness, brain fog, palpitations and post-exertional worsening.',
        points: [
          'Diagnosis is clinical, after excluding treatable causes such as anaemia, thyroid disease and cardiac complications.',
          'Pacing helps where post-exertional symptom exacerbation is present; aggressive exercise can worsen it.',
          'Vaccination and reinfection avoidance lower the risk.',
          'No specific licensed treatment yet; rehabilitation is multidisciplinary and symptom-led.',
        ],
        why: 'Millions remain affected and unable to work, and the syndrome has renewed interest in other post-infectious illnesses such as ME/CFS.',
      },
      {
        label: 'Pandemic preparedness',
        wiki: 'Pandemic_prevention',
        summary:
          'Systems to detect, contain and respond to outbreaks: surveillance, laboratory networks, stockpiles, surge capacity, and rules for sharing samples and vaccines.',
        points: [
          'Genomic and wastewater surveillance give early warning of new variants and pathogens.',
          'Equitable access to vaccines and treatments is the central unresolved political issue.',
          'Zoonotic spillover risk rises with land-use change, live animal markets and intensive farming.',
          'Avian influenza H5N1 in mammals, including dairy cattle, is closely watched.',
        ],
        why: 'Countries are negotiating and implementing new international agreements while funding for preparedness is being cut.',
      },
    ],
  },
  {
    group: 'Chronic & lifestyle disease',
    topics: [
      {
        label: 'Diabetes',
        wiki: 'Diabetes',
        summary:
          'Chronically raised blood glucose from insulin deficiency (type 1) or resistance with relative deficiency (type 2), causing eye, kidney, nerve and vascular damage.',
        points: [
          'SGLT2 inhibitors and GLP-1 receptor agonists reduce cardiovascular and kidney events, not just glucose.',
          'Continuous glucose monitoring and automated insulin delivery improve type 1 control.',
          'Screening for retinopathy, nephropathy and foot disease prevents avoidable loss of sight and limbs.',
          'South Asians develop type 2 diabetes younger and at lower body mass index.',
        ],
        why: 'Prevalence keeps climbing, especially in South Asia and Africa, while newer drug classes remain expensive and unevenly available.',
      },
      {
        label: 'Obesity and GLP-1 drugs',
        wiki: 'Anti-obesity_medication',
        summary:
          'Obesity is a chronic relapsing condition driven by biology and environment. GLP-1 based drugs (semaglutide, tirzepatide) produce weight loss previously seen only with surgery.',
        points: [
          'Benefits extend to cardiovascular events, sleep apnoea, fatty liver and knee osteoarthritis symptoms.',
          'Side effects are mainly gastrointestinal; muscle loss and regain after stopping are active concerns.',
          'Bariatric surgery remains the most durable option for severe obesity.',
          'Access, cost, counterfeit supply and use for cosmetic weight loss are live issues.',
        ],
        why: 'These drugs are reshaping obesity and diabetes practice, and straining budgets and supply chains worldwide.',
      },
      {
        label: 'Hypertension',
        wiki: 'Hypertension',
        summary:
          'Persistently raised blood pressure, the leading modifiable cause of stroke, heart failure, kidney disease and dementia; usually symptomless until damage is done.',
        points: [
          'Diagnosis should be confirmed with home or ambulatory readings where possible.',
          'Single-pill combinations improve adherence over multiple tablets.',
          'Salt reduction, weight, alcohol, activity and sleep all shift readings meaningfully.',
          'Detection and control rates remain low even where drugs are cheap.',
        ],
        why: 'Simplified treatment protocols and community screening programmes are being scaled up across low- and middle-income countries.',
      },
      {
        label: 'Heart failure',
        wiki: 'Heart_failure',
        summary:
          'The heart cannot meet the body\'s needs at normal filling pressures, causing breathlessness, fatigue and fluid overload; classified by ejection fraction.',
        points: [
          'Four pillars for reduced ejection fraction: ARNI/ACE inhibitor, beta blocker, MRA and SGLT2 inhibitor.',
          'SGLT2 inhibitors also help preserved ejection fraction, long a therapeutic gap.',
          'Devices (ICD, CRT) and transplantation serve selected patients.',
          'Early follow-up after discharge reduces readmission.',
        ],
        why: 'Rapid, early initiation of all four drug classes has replaced slow sequential titration in guidelines.',
      },
      {
        label: 'Stroke',
        wiki: 'Stroke',
        summary:
          'Sudden loss of brain function from blocked (ischaemic) or ruptured (haemorrhagic) vessels; a leading cause of death and long-term disability.',
        points: [
          'Thrombolysis and mechanical thrombectomy are time-critical: organised stroke pathways matter more than any single drug.',
          'Imaging-based selection has widened thrombectomy windows well beyond six hours in some patients.',
          'Atrial fibrillation, hypertension, diabetes, smoking and lipids drive most preventable strokes.',
          'Early rehabilitation strongly influences recovery.',
        ],
        why: 'Expanding thrombectomy beyond big cities is a major service-design challenge worldwide.',
      },
      {
        label: 'Chronic kidney disease',
        wiki: 'Chronic_kidney_disease',
        summary:
          'Progressive loss of kidney function, usually from diabetes or hypertension, often silent until advanced, ending in dialysis or transplantation.',
        points: [
          'Staging uses eGFR plus albuminuria; urine ACR is under-used.',
          'SGLT2 inhibitors, ACE inhibitors/ARBs and finerenone slow progression.',
          'Dialysis access and cost dominate outcomes in low- and middle-income countries.',
          'Unexplained CKD clusters in hot agricultural regions remain under investigation.',
        ],
        why: 'Drugs that genuinely slow progression have arrived, which makes early detection worth far more than before.',
      },
      {
        label: 'COPD and asthma',
        wiki: 'Chronic_obstructive_pulmonary_disease',
        summary:
          'Common airway diseases: asthma is variable and usually reversible; COPD is largely fixed obstruction from smoking, biomass smoke and pollution.',
        points: [
          'Inhaled corticosteroid-containing therapy, not short-acting relievers alone, is standard in asthma.',
          'Biologics help severe eosinophilic and allergic asthma.',
          'Spirometry is required to diagnose COPD; it is widely under-used.',
          'Household biomass smoke and outdoor pollution are major non-smoking causes.',
        ],
        why: 'Air quality has become a mainstream clinical issue, and inhaler propellants are being reformulated for climate reasons.',
      },
      {
        label: 'Fatty liver disease',
        wiki: 'Metabolic_dysfunction-associated_steatotic_liver_disease',
        summary:
          'Fat accumulation in the liver linked to metabolic syndrome, renamed MASLD/MASH; now among the commonest causes of chronic liver disease and a rising cause of liver cancer.',
        points: [
          'Non-invasive scores (FIB-4) and elastography identify who needs specialist referral.',
          'Weight loss of 7–10% can reverse steatohepatitis.',
          'First targeted drug therapy has reached the market for selected patients with fibrosis.',
          'Alcohol, diabetes and obesity have additive effects.',
        ],
        why: 'The renaming, new drug approvals and its rise in young adults have put it firmly on the agenda.',
      },
    ],
  },
  {
    group: 'Cancer & genetics',
    topics: [
      {
        label: 'Immunotherapy',
        wiki: 'Cancer_immunotherapy',
        summary:
          'Treatment that unleashes or engineers the immune system against cancer: checkpoint inhibitors, CAR-T cells, bispecific antibodies and cancer vaccines.',
        points: [
          'Checkpoint inhibitors transformed melanoma, lung, kidney and bladder cancer outcomes.',
          'CAR-T therapy gives durable remissions in some blood cancers; access and cost are limiting.',
          'Immune-related adverse events affect any organ and need early steroids and specialist input.',
          'Biomarkers (PD-L1, MSI-high, tumour mutational burden) guide selection imperfectly.',
        ],
        why: 'Indications keep expanding into earlier-stage disease and combinations, while cost raises hard access questions.',
      },
      {
        label: 'Targeted cancer therapy',
        wiki: 'Targeted_therapy',
        summary:
          'Drugs aimed at specific molecular changes in a tumour — EGFR, ALK, HER2, BRAF, KRAS G12C, BRCA — rather than at dividing cells in general.',
        points: [
          'Requires molecular testing before treatment; tissue or liquid biopsy.',
          'Antibody-drug conjugates have redrawn breast and lung cancer treatment lines.',
          'Resistance emerges predictably, driving sequential testing and next-generation agents.',
          'Testing capacity, not drug availability alone, limits use in many countries.',
        ],
        why: 'Genomic testing is moving into routine oncology, turning several cancers into biomarker-defined subtypes.',
      },
      {
        label: 'Cancer screening',
        wiki: 'Cancer_screening',
        summary:
          'Testing people without symptoms to find cancer early or prevent it: cervical, breast, colorectal, lung and in some settings oral and stomach cancers.',
        points: [
          'HPV testing has replaced cytology as the primary cervical screen in many programmes.',
          'Low-dose CT screening reduces lung cancer deaths in heavy smokers.',
          'Overdiagnosis and false positives are real harms to weigh, not just statistics.',
          'Organised, invitation-based programmes outperform opportunistic testing.',
        ],
        why: 'Multi-cancer blood tests are being trialled, and HPV self-sampling is expanding reach in low-resource settings.',
      },
      {
        label: 'Genomic medicine',
        wiki: 'Genomics',
        summary:
          'Using genome-scale information for diagnosis, drug choice and risk prediction, from rare disease sequencing to pharmacogenomics and polygenic scores.',
        points: [
          'Rapid whole-genome sequencing can diagnose critically ill newborns within days.',
          'Pharmacogenomics guides dosing for drugs such as clopidogrel, azathioprine and some chemotherapy.',
          'Variants of uncertain significance and counselling capacity are practical bottlenecks.',
          'Most reference data come from European populations, limiting accuracy elsewhere.',
        ],
        why: 'Sequencing cost has fallen far enough for national genome programmes, raising questions of equity and data governance.',
      },
      {
        label: 'CRISPR and gene editing',
        wiki: 'CRISPR_gene_editing',
        summary:
          'Tools that cut or rewrite DNA at chosen sites, used to correct disease-causing variants in cells outside the body or, increasingly, inside it.',
        points: [
          'An approved ex vivo therapy treats sickle cell disease and beta thalassaemia.',
          'In vivo editing is being trialled for liver-based conditions such as transthyretin amyloidosis and high cholesterol.',
          'Base and prime editing aim to avoid double-strand breaks and off-target damage.',
          'Heritable (germline) editing remains prohibited in most jurisdictions.',
        ],
        why: 'The first approvals turned gene editing from promise into practice, and the debate has shifted to price and access.',
      },
      {
        label: 'Rare diseases',
        wiki: 'Rare_disease',
        summary:
          'Individually uncommon conditions, mostly genetic and often childhood-onset, that together affect a large share of the population.',
        points: [
          'Diagnostic odysseys of years are common; early sequencing shortens them.',
          'Newborn screening panels are expanding as treatments appear.',
          'Gene and enzyme replacement therapies are effective but among the costliest drugs ever priced.',
          'Patient registries and international collaboration are essential for trials.',
        ],
        why: 'Treatments now exist for conditions that had none, forcing health systems to decide what they can fund.',
      },
      {
        label: 'Precision medicine',
        wiki: 'Personalized_medicine',
        summary:
          'Matching prevention and treatment to the characteristics of an individual — genetic, molecular, environmental and behavioural — rather than to population averages.',
        points: [
          'Best established in oncology, cystic fibrosis modulators and pharmacogenomics.',
          'Needs linked data, testing infrastructure and clinician training to work.',
          'Risks widening inequality if only well-resourced systems can deliver it.',
          'Prediction models must be validated in the population where they are used.',
        ],
        why: 'It is the organising idea behind national genomics, biobank and AI programmes in many countries.',
      },
    ],
  },
  {
    group: 'Brain & mental health',
    topics: [
      {
        label: 'Dementia and Alzheimer disease',
        wiki: 'Alzheimer%27s_disease',
        summary:
          'Progressive loss of memory, language, judgement and independence; Alzheimer disease is the commonest cause, followed by vascular and Lewy body dementia.',
        points: [
          'Anti-amyloid antibodies modestly slow early Alzheimer decline but require infusions, PET/CSF confirmation and monitoring for brain swelling and bleeding.',
          'Blood-based biomarkers are moving diagnosis out of specialist centres.',
          'Hearing loss, hypertension, diabetes, smoking, inactivity, depression and social isolation are modifiable risks.',
          'Carer support and advance planning often matter more day to day than any drug.',
        ],
        why: 'The first disease-modifying drugs arrived alongside evidence that a large share of dementia risk is preventable.',
      },
      {
        label: 'Depression and anxiety',
        wiki: 'Major_depressive_disorder',
        summary:
          'The commonest mental health conditions worldwide, causing enormous disability and strongly linked to physical illness and suicide risk.',
        points: [
          'Structured psychological therapy and medication are both first-line; combination helps moderate to severe illness.',
          'Task-shifting to trained lay counsellors extends care where psychiatrists are scarce.',
          'Treatment-resistant depression options include ketamine/esketamine and neuromodulation.',
          'Always ask directly about suicidal thoughts, means and protective factors.',
        ],
        why: 'Demand has risen faster than services everywhere, pushing digital and community-delivered care.',
      },
      {
        label: 'Adolescent mental health',
        wiki: 'Adolescent_health',
        summary:
          'Most lifelong mental illness begins before age 25, making adolescence the key window for detection and intervention.',
        points: [
          'Self-harm, eating disorders and anxiety presentations rose sharply in many countries after 2020.',
          'Evidence on social media is contested: displaced sleep, comparison and bullying are clearer harms than screen time alone.',
          'School-based programmes and family involvement improve outcomes.',
          'Transition from child to adult services is a common point of disengagement.',
        ],
        why: 'Governments are legislating on phones and social media in schools while the evidence is still being argued.',
      },
      {
        label: 'Epilepsy',
        wiki: 'Epilepsy',
        summary:
          'Recurrent unprovoked seizures from abnormal cortical electrical activity; most people become seizure-free on appropriate medication.',
        points: [
          'Classification of seizure and syndrome type guides drug choice.',
          'Valproate is avoided in women of childbearing potential wherever alternatives exist.',
          'Drug-resistant epilepsy deserves early surgical and device assessment, not endless drug trials.',
          'A large treatment gap persists in low-income settings despite cheap effective drugs.',
        ],
        why: 'Stigma and the treatment gap remain global priorities, and newer agents have reduced teratogenic risk.',
      },
      {
        label: 'Parkinson disease',
        wiki: 'Parkinson%27s_disease',
        summary:
          'Progressive loss of dopaminergic neurons causing tremor, rigidity, slowness and later cognitive and autonomic problems.',
        points: [
          'Levodopa remains the most effective symptomatic drug; timing and formulation manage fluctuations.',
          'Deep brain stimulation and infusion therapies help selected people with motor fluctuations.',
          'Non-motor symptoms — constipation, REM sleep behaviour disorder, depression, hypotension — often predate diagnosis.',
          'Exercise has consistent functional benefit.',
        ],
        why: 'Prevalence is rising faster than ageing alone explains, prompting research into environmental exposures.',
      },
      {
        label: 'Sleep medicine',
        wiki: 'Sleep_medicine',
        summary:
          'Diagnosis and treatment of insomnia, obstructive sleep apnoea, circadian disorders and parasomnias, all closely tied to cardiometabolic and mental health.',
        points: [
          'Cognitive behavioural therapy for insomnia outperforms hypnotics long term.',
          'Untreated obstructive sleep apnoea worsens blood pressure, arrhythmia and daytime safety.',
          'Home sleep testing has widened access to diagnosis.',
          'Shift work is an occupational health issue for healthcare staff themselves.',
        ],
        why: 'Weight-loss drugs, home testing and consumer sleep tracking have all pushed sleep into mainstream practice.',
      },
      {
        label: 'Burnout in healthcare',
        wiki: 'Occupational_burnout',
        summary:
          'Emotional exhaustion, detachment and reduced sense of accomplishment arising from chronic workplace stress; widespread among clinicians and students.',
        points: [
          'Drivers are systemic: staffing, workload, documentation, moral injury and lack of control.',
          'Individual resilience training alone does not fix organisational causes.',
          'It is linked to medical error, absenteeism and people leaving the profession.',
          'Confidential help must be genuinely separate from licensing consequences.',
        ],
        why: 'Workforce shortages after the pandemic made retention, not recruitment alone, the central health workforce issue.',
      },
    ],
  },
  {
    group: 'Women, children & ageing',
    topics: [
      {
        label: 'Maternal health',
        wiki: 'Maternal_health',
        summary:
          'Care through pregnancy, birth and the postpartum period. Most maternal deaths are preventable and come from haemorrhage, hypertensive disorders, sepsis and unsafe abortion.',
        points: [
          'Heat-stable carbetocin and tranexamic acid have strengthened haemorrhage management.',
          'Aspirin from early pregnancy reduces pre-eclampsia in high-risk women.',
          'Skilled attendance, blood availability and timely referral decide survival.',
          'Postpartum depression and anaemia are widely under-detected.',
        ],
        why: 'Global progress has stalled, and disparities between and within countries remain stark.',
      },
      {
        label: 'Neonatal care',
        wiki: 'Neonatology',
        summary:
          'Care of newborns, especially preterm and low-birthweight babies, who account for a large share of under-five deaths.',
        points: [
          'Immediate kangaroo mother care improves survival in small babies.',
          'Antenatal corticosteroids, delayed cord clamping and thermal care are high-impact basics.',
          'Surfactant and CPAP reduce deaths from respiratory distress.',
          'Neonatal sepsis increasingly involves resistant organisms.',
        ],
        why: 'Simple, low-cost interventions still reach too few babies, and resistant neonatal sepsis is worsening.',
      },
      {
        label: 'Fertility and IVF',
        wiki: 'In_vitro_fertilisation',
        summary:
          'Assisted reproduction for infertility affecting roughly one in six people at some point, including IVF, ICSI, donor gametes and fertility preservation.',
        points: [
          'Success falls sharply with maternal age; single embryo transfer reduces multiple-pregnancy risk.',
          'Fertility preservation before cancer treatment is now standard counselling.',
          'Cost, regulation of donation and surrogacy vary hugely between countries.',
          'Male factor accounts for around half of cases and is often under-investigated.',
        ],
        why: 'Falling birth rates and later parenthood have pushed fertility services into national policy debates.',
      },
      {
        label: 'Childhood nutrition',
        wiki: 'Child_nutrition',
        summary:
          'Nutrition in the first 1000 days shapes growth, brain development and lifelong disease risk; stunting, wasting, anaemia and now childhood obesity coexist.',
        points: [
          'Exclusive breastfeeding for six months, then safe complementary feeding, is the foundation.',
          'Ready-to-use therapeutic food treats severe acute malnutrition in the community.',
          'Iron, vitamin A, iodine and zinc deficiencies remain common and correctable.',
          'Ultra-processed food marketing to children is a growing regulatory target.',
        ],
        why: 'Many countries now face undernutrition and childhood obesity at the same time, in the same communities.',
      },
      {
        label: 'Menopause',
        wiki: 'Menopause',
        summary:
          'The end of menstrual cycles and the years around it, with vasomotor symptoms, sleep disturbance, mood change, genitourinary symptoms and accelerated bone loss.',
        points: [
          'Hormone therapy is effective and, started near menopause in suitable women, has a favourable risk-benefit balance.',
          'Non-hormonal options include newer neurokinin-3 receptor antagonists for hot flushes.',
          'Local vaginal oestrogen safely treats genitourinary symptoms.',
          'Bone density and cardiovascular risk should be reviewed at this stage.',
        ],
        why: 'Decades of over-caution after early trial reporting are being revisited, and workplace policies are emerging.',
      },
      {
        label: 'Healthy ageing',
        wiki: 'Ageing',
        summary:
          'Maintaining function and independence in later life, focusing on mobility, cognition, continence, nutrition, medication safety and social connection.',
        points: [
          'Comprehensive geriatric assessment improves outcomes after admission.',
          'Deprescribing and falls prevention are among the highest-yield interventions.',
          'Frailty and sarcopenia predict outcomes better than age alone.',
          'Loneliness carries measurable physical health risk.',
        ],
        why: 'Populations are ageing fastest in countries whose health systems were built for infectious disease and maternal care.',
      },
      {
        label: 'Palliative care',
        wiki: 'Palliative_care',
        summary:
          'Relief of suffering and support for quality of life in serious illness, alongside disease-directed treatment, not only at the end of life.',
        points: [
          'Early palliative care in advanced cancer improves quality of life and sometimes survival.',
          'Opioid access for cancer pain remains severely restricted in many countries.',
          'Advance care planning respects patient priorities and reduces unwanted intervention.',
          'Family and carer support is part of the service, including bereavement.',
        ],
        why: 'Ageing populations and cancer burden have outgrown the specialist workforce, pushing training into general practice.',
      },
    ],
  },
  {
    group: 'Global & public health',
    topics: [
      {
        label: 'Climate change and health',
        wiki: 'Effects_of_climate_change_on_human_health',
        summary:
          'Heat, extreme weather, shifting vector ranges, crop failure and displacement all affect health, while healthcare itself contributes to emissions.',
        points: [
          'Heat harms outdoor workers, pregnant women, older adults and people on psychotropics or diuretics most.',
          'Dengue, malaria and tick-borne disease ranges are shifting with temperature and rainfall.',
          'Hospitals need heat-action plans, resilient power and water.',
          'Anaesthetic gases and metered-dose inhalers are significant clinical emission sources.',
        ],
        why: 'Record heat years have turned this from a forecast into current clinical workload.',
      },
      {
        label: 'Air pollution',
        wiki: 'Air_pollution',
        summary:
          'Fine particulate matter and gases from traffic, industry, crop burning and household fuel; a leading environmental cause of death worldwide.',
        points: [
          'Linked to stroke, ischaemic heart disease, COPD, lung cancer, low birthweight and dementia.',
          'PM2.5 penetrates deep into the lungs and enters the bloodstream.',
          'Clean household fuels give the fastest gains where biomass cooking is common.',
          'South Asian cities record some of the world\'s highest concentrations.',
        ],
        why: 'Tightened WHO guideline values have exposed how far most cities are from safe levels.',
      },
      {
        label: 'Health equity',
        wiki: 'Health_equity',
        summary:
          'Avoidable, unfair differences in health between groups defined by income, geography, gender, caste, ethnicity or disability.',
        points: [
          'Social determinants — income, education, housing, water, work — outweigh clinical care in shaping outcomes.',
          'Catastrophic out-of-pocket spending pushes millions into poverty each year.',
          'Rural and remote populations face workforce and transport barriers, not just cost.',
          'Clinical algorithms and AI can encode existing bias if not checked.',
        ],
        why: 'Widening gaps after the pandemic and aid funding cuts have made equity central to health policy debate.',
      },
      {
        label: 'Universal health coverage',
        wiki: 'Universal_health_care',
        summary:
          'Everyone receiving needed health services of sufficient quality without financial hardship, usually through tax funding or social insurance.',
        points: [
          'Strong primary care is the most cost-effective route to coverage.',
          'Insurance schemes must cover outpatient care and medicines, not only hospitalisation.',
          'Health workforce supply, not just financing, sets the practical ceiling.',
          'Essential medicines lists and pooled procurement control cost.',
        ],
        why: 'Large national insurance schemes are expanding while budgets tighten, forcing hard prioritisation.',
      },
      {
        label: 'Disaster and conflict medicine',
        wiki: 'Disaster_medicine',
        summary:
          'Care when demand overwhelms resources: earthquakes, floods, mass casualties and war, including triage, field surgery and public health in displacement.',
        points: [
          'Triage systems aim for the greatest good, which changes familiar treatment priorities.',
          'Crush injury, burns, wound infection and mental trauma dominate casualty loads.',
          'Water, sanitation, measles vaccination and nutrition prevent the secondary death toll.',
          'Attacks on healthcare facilities and staff have risen in recent conflicts.',
        ],
        why: 'The number of people displaced by conflict and disaster is at record levels, with health systems among the casualties.',
      },
      {
        label: 'Snakebite and tropical medicine',
        wiki: 'Snakebite',
        summary:
          'Neglected tropical conditions — snakebite envenoming, rabies, leishmaniasis, lymphatic filariasis, leprosy, soil-transmitted helminths — affecting the rural poor.',
        points: [
          'Snakebite kills tens of thousands yearly, mostly farmers; antivenom supply and species matching are the barriers.',
          'Rabies is nearly always fatal once symptomatic but fully preventable by wound care and prophylaxis.',
          'Mass drug administration has eliminated lymphatic filariasis in several countries.',
          'First aid myths (tourniquets, cutting, suction) still cause harm.',
        ],
        why: 'Snakebite and rabies elimination targets have brought funding to conditions long ignored.',
      },
      {
        label: 'Nutrition and food security',
        wiki: 'Food_security',
        summary:
          'Reliable access to enough safe, nutritious food. Undernutrition, micronutrient deficiency and diet-related chronic disease now coexist globally.',
        points: [
          'Conflict, climate shocks and price inflation drive acute food insecurity.',
          'Food fortification (salt iodisation, flour with iron and folic acid) is highly cost-effective.',
          'Front-of-pack labelling and marketing rules shift purchasing behaviour.',
          'Ultra-processed food intake is associated with obesity and cardiometabolic disease.',
        ],
        why: 'Food prices and conflict have pushed acute hunger up while processed-food disease keeps rising.',
      },
      {
        label: 'Tobacco and substance use',
        wiki: 'Tobacco_control',
        summary:
          'Tobacco, alcohol and other substances remain leading preventable causes of death, with newer nicotine and synthetic opioid products changing the picture.',
        points: [
          'Taxation, plain packaging, advertising bans and smoke-free laws are the proven levers.',
          'Smokeless tobacco and areca nut drive oral cancer across South Asia.',
          'Vaping among adolescents is a growing concern even where it helps some adults quit.',
          'Synthetic opioids have made overdose response and naloxone access urgent.',
        ],
        why: 'Regulation is racing to keep up with vapes, nicotine pouches and synthetic drugs.',
      },
    ],
  },
  {
    group: 'Practice & research',
    topics: [
      {
        label: 'Evidence-based medicine',
        wiki: 'Evidence-based_medicine',
        summary:
          'Combining the best available research with clinical expertise and patient values, rather than relying on habit or authority.',
        points: [
          'Study design determines how much a result can be trusted; randomisation limits confounding.',
          'Absolute risk reduction and numbers needed to treat communicate benefit better than relative risk.',
          'Publication bias, industry funding and spin distort the literature.',
          'Guidelines must be read in the context of the population they were written for.',
        ],
        why: 'The volume of publication, preprints and AI-generated text has made appraisal skills more important, not less.',
      },
      {
        label: 'Clinical trials',
        wiki: 'Clinical_trial',
        summary:
          'Prospective studies testing interventions in people, from first-in-human safety through to large randomised outcome trials and pragmatic trials in routine care.',
        points: [
          'Registration, protocol publication and reporting of negative results are ethical requirements.',
          'Adaptive and platform designs answer several questions in one structure.',
          'Decentralised trials use remote consent and monitoring to widen participation.',
          'Under-representation of women, older adults and non-European populations limits generalisability.',
        ],
        why: 'Pandemic platform trials showed how fast good trials can run, and that standard is now expected elsewhere.',
      },
      {
        label: 'Medical education',
        wiki: 'Medical_education',
        summary:
          'How clinicians are trained and assessed: competency frameworks, simulation, workplace-based assessment and continuing professional development.',
        points: [
          'Simulation allows deliberate practice of rare emergencies without risk to patients.',
          'Competency-based progression is replacing purely time-based training in many countries.',
          'Assessment increasingly includes communication, ethics and teamwork, not only knowledge.',
          'AI tools are forcing a rethink of written assessment and clinical reasoning teaching.',
        ],
        why: 'Workforce shortages and AI have made curriculum reform urgent in most countries.',
      },
      {
        label: 'Patient safety',
        wiki: 'Patient_safety',
        summary:
          'Preventing avoidable harm in care: medication error, surgical error, hospital-acquired infection, falls, diagnostic error and communication failures.',
        points: [
          'Checklists, structured handover and safe prescribing systems reduce measurable harm.',
          'Just culture — learning from incidents rather than blaming individuals — drives reporting.',
          'Diagnostic error is the least measured and possibly largest category.',
          'Understaffing is itself a patient safety hazard.',
        ],
        why: 'Safety and workforce strain are now discussed together rather than separately.',
      },
      {
        label: 'Sepsis care',
        wiki: 'Sepsis',
        summary:
          'Life-threatening organ dysfunction from a dysregulated response to infection; survival depends on how quickly it is recognised and treated.',
        points: [
          'Early recognition, cultures, appropriate antibiotics, fluids and source control are the core.',
          'Lactate and clinical scores support but do not replace bedside assessment.',
          'Overly liberal fluids and broad antibiotics carry their own harms.',
          'Post-sepsis syndrome leaves survivors with lasting physical and cognitive problems.',
        ],
        why: 'Guidance is being rebalanced between speed and antimicrobial stewardship.',
      },
      {
        label: 'Organ transplantation',
        wiki: 'Organ_transplantation',
        summary:
          'Replacing failed organs with donated ones, limited everywhere by donor availability, organ preservation and lifelong immunosuppression.',
        points: [
          'Machine perfusion keeps organs viable longer and allows assessment before use.',
          'Opt-out consent and family refusal rates strongly influence donation numbers.',
          'Xenotransplantation has reached early human attempts but remains experimental.',
          'Transplant tourism and organ trafficking remain serious ethical problems.',
        ],
        why: 'Perfusion technology and xenotransplant trials are expanding what counts as a usable organ.',
      },
      {
        label: 'Antibiotic stewardship',
        wiki: 'Antimicrobial_stewardship',
        summary:
          'Coordinated effort to use antimicrobials only when needed, with the right drug, dose, route and duration, to preserve effectiveness and reduce harm.',
        points: [
          'Shorter courses are as effective as longer ones for many common infections.',
          'Review at 48–72 hours to de-escalate based on cultures is a core practice.',
          'Rapid diagnostics and procalcitonin can support stopping decisions.',
          'WHO AWaRe categories guide which agents to protect.',
        ],
        why: 'It is the main practical defence against resistance while few new antibiotics reach the market.',
      },
      {
        label: 'Medical ethics',
        wiki: 'Medical_ethics',
        summary:
          'The reasoning behind difficult decisions: autonomy, beneficence, non-maleficence and justice, applied to consent, confidentiality, end of life and resource allocation.',
        points: [
          'Valid consent requires capacity, information and voluntariness.',
          'Confidentiality has limits, including serious risk to others and legal duties.',
          'Rationing decisions should be explicit, consistent and open to challenge.',
          'AI, genomics and data sharing raise new questions about consent for secondary use.',
        ],
        why: 'Data, AI and cost pressures are generating ethical questions faster than codes can be revised.',
      },
    ],
  },
];
