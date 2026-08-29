// Shared notice metadata (spec/05 `notice_acknowledgement`). Bump the version
// whenever the privacy notice or the usage rules change materially — users
// then re-acknowledge at their next sign-in, and old rows stay as evidence of
// what they saw when.

export const NOTICE_VERSION = "2026-08-29";

export const NOTICE_TYPES = ["privacy_notice", "acceptable_use", "no_patient_data"] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export const PRIVACY_NOTICE_PATH = "/privacy";

export const OPERATOR_NAME = "Akanimoh Osutuk";
export const OPERATOR_CONTACT_EMAIL = "0xchromatin@proton.me";
