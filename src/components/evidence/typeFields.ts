// Type-specific additional fields (spec/06 table). Values are stored as
// strings in evidence_item.type_fields_json. Never ask for access tokens.

export interface TypeFieldDef {
  key: string;
  label: string;
  kind: "text" | "date" | "select";
  required?: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
}

export const TYPE_FIELDS: Record<string, TypeFieldDef[]> = {
  learning_record: [
    { key: "activityProvider", label: "Learning activity or provider", kind: "text" },
    { key: "duration", label: "Duration", kind: "text", hint: "Optional, e.g. 2 hours" },
  ],
  reflection: [],
  certificate: [
    { key: "issuer", label: "Issuer", kind: "text", required: true },
    { key: "certificateDate", label: "Certificate date", kind: "date", required: true },
    { key: "expiryDate", label: "Expiry date", kind: "date" },
    { key: "credentialUrlOrId", label: "Credential URL or ID", kind: "text" },
  ],
  award: [
    { key: "awardingBody", label: "Awarding body", kind: "text", required: true },
    { key: "awardDate", label: "Award date", kind: "date", required: true },
  ],
  poster: [
    { key: "event", label: "Event", kind: "text", required: true },
    { key: "presentationDate", label: "Presentation date", kind: "date" },
    { key: "contribution", label: "Authorship / contribution", kind: "text" },
  ],
  publication: [
    { key: "citationTitle", label: "Citation / title", kind: "text", required: true },
    { key: "journalPublisher", label: "Journal or publisher", kind: "text" },
    { key: "publicationDateOrStatus", label: "Publication date or status", kind: "text" },
    { key: "doiOrUrl", label: "DOI or URL", kind: "text" },
    { key: "contribution", label: "Contribution", kind: "text" },
  ],
  presentation: [
    { key: "eventAudience", label: "Event / audience", kind: "text", required: true },
    { key: "deliveredDate", label: "Delivered date", kind: "date" },
    { key: "role", label: "Role", kind: "text" },
    { key: "slidesLink", label: "Slides link", kind: "text", hint: "https:// link only" },
  ],
  code_artifact: [
    {
      key: "repositoryUrl",
      label: "Repository or host URL",
      kind: "text",
      required: true,
      hint: "https:// link. Never enter access tokens or credentials.",
    },
    {
      key: "artefactKind",
      label: "Artefact kind",
      kind: "select",
      required: true,
      options: [
        { value: "repository", label: "Repository" },
        { value: "commit", label: "Commit" },
        { value: "pull_request", label: "Pull request" },
        { value: "release", label: "Release" },
        { value: "notebook", label: "Notebook" },
        { value: "other", label: "Other" },
      ],
    },
    { key: "revisionShaOrTag", label: "Revision, tag or SHA", kind: "text" },
    { key: "contribution", label: "Your contribution", kind: "text" },
    {
      key: "accessStatus",
      label: "Access status",
      kind: "select",
      required: true,
      options: [
        { value: "public", label: "Public" },
        { value: "restricted", label: "Restricted" },
        { value: "private", label: "Private" },
      ],
    },
  ],
};

export const REFLECTION_SAFETY_TEXT =
  "Focus on what you learned and what you will do differently. Do not include names, dates of birth, NHS numbers, images, rare combinations of facts, or other details that could identify a patient, colleague or third party. This diary is not a clinical record or incident-reporting system. Reflective notes can be subject to lawful disclosure, so write only what belongs in your private learning record.";

export const REFLECTION_ACK_LABEL =
  "I have removed identifiable patient and third-party details.";
