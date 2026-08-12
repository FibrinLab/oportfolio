# Sources and verification notes

Verified on 12 August 2026. Product and governance decisions must be rechecked before a live pilot.

## Primary curriculum source

- [NHS Fellowship in Clinical AI — Clinical AI Curriculum v3.2 (Cohort 3, 2024)](https://gstt-csc.github.io/assets/docs/FCAI_Curriculum_v3.2.pdf), Guy's & St Thomas' Clinical Scientific Computing. The public file identifies itself as version 3.2, Cohort 3 and contains the five themes, learning objectives, external alignments, delivery methods, duties, 12-month/0.4 FTE programme shape, supervision cadence, PDP/SWOT and portfolio requirements used here.
- Public availability was confirmed on the verification date. This does **not** establish that v3.2 is the canonical curriculum for Cohort 5 or later. The curriculum version and the three formal supervision templates must be obtained from faculty before pilot configuration.

## Governance and professional guidance

- [ICO: Data protection impact assessments](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-impact-assessments/). A DPIA is required for likely high-risk processing and is good practice for major projects involving personal data. It should begin before processing and be reviewed as the system changes.
- [ICO: Rules for special-category data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/). If reflection or feedback captures health, ethnicity or other special-category data, the controller needs an Article 6 basis, an Article 9 condition where applicable, appropriate safeguards and possibly an appropriate policy document.
- [NHS Records Management Code of Practice 2021](https://transform.england.nhs.uk/media/documents/NHSX_Records_Management_CoP_V7.pdf). Applies to records in all formats and covers lifecycle, access, retention and disposal. The adopting controller must map oPortfolio record classes to its approved retention schedule; this specification must not invent a universal period.
- [GMC: Disclosure of reflective notes](https://www.gmc-uk.org/education/standards-guidance-and-curricula/guidance/reflective-practice/the-reflective-practitioner---supplementary-guidance-for-medical-students/disclosure-of-reflective-notes). Reflective notes should focus on learning and should rarely introduce factual case details not recorded elsewhere. This informs reflection warnings and visibility controls; it is not a promise that reflections can never be disclosed.
- [NHS England: Board and executive assurance — cyber security risk (10 June 2026)](https://www.england.nhs.uk/long-read/board-and-executive-assurance-cyber-security-risk/). Describes the CAF-aligned Data Security and Protection Toolkit as the standard frontline NHS organisations are expected to meet. Exact applicability and evidence remain deployment-specific.

## Interaction and accessibility references

- [W3C: Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/). The service targets WCAG 2.2 AA, including the newer focus-not-obscured, dragging-alternative, target-size and accessible-authentication requirements.
- [NHS digital service manual: Focus state](https://service-manual.nhs.uk/design-system/styles/focus-state). Confirms that visible focus must remain strong across backgrounds. oPortfolio uses its own tested monochrome double-ring approach rather than the NHS site's yellow brand focus style.
- [Royal College of Radiologists: Kaizen supervisor guide](https://www.rcr.ac.uk/media/gv0n1ttd/rcr-how-to-guides_kaizen-breast-clinician-supervisor-guide_23.pdf). Used only as evidence that Kaizen is an established eportfolio/supervisor workflow reference. oPortfolio does not copy its interface or assume its detailed behavior.

## Source-to-product interpretation

| Source statement | Product interpretation |
|---|---|
| Portfolio demonstrates progress against PDP objectives | Evidence-to-objective mappings plus goal progress and chronological history |
| Portfolio includes learning, reflections, certificates, awards, posters, publications, presentations and code repository | Eight first-class evidence types; administrators may add configured types without deleting the canonical set |
| Named AI supervisor provides weekly supervision | Reusable supervision-log object plus reminders; weekly notes are not formal sign-offs |
| Induction, midpoint and end appraisal use templates | Three configurable, versioned templates and immutable signed snapshots |
| Framework aligns to national frameworks | Cross-mapping nodes are versioned data; published v3.2 mappings are domain-level unless faculty supplies objective-level mappings |
| Portfolio contributes evidence to supervisor reports | Formal review builder pulls selected evidence/PDP state into a snapshot; it does not infer competence automatically |

## Known source ambiguities

1. The curriculum refers to “large group teaching” and “self-directed learning” in one figure caption but describes four delivery methods as immersive project, small group workshops, e-learning and networking. The package uses the four named methods; aliases can be configured on import.
2. Published framework mappings are theme/domain-level. The system must not imply objective-level endorsement unless a later source explicitly supplies it.
3. The source names three supervision templates but does not publish their field content in the curriculum PDF. Forms in this specification are safe working proposals pending faculty templates.
4. “Code repository” does not mandate GitHub. Manual URL evidence is therefore the portable baseline.
