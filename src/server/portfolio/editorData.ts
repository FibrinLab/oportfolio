import type { Actor } from "@/server/policy/actor";
import { getCurriculumForEnrolment, getOwnEnrolment } from "@/server/framework/queries";
import { getEvidenceFormOptions } from "./evidence";
import type { EnrolmentContext } from "@/server/policy/policy";

// Everything the evidence editor page needs in one load.

export async function getEditorContext(actor: Actor, tenantId: string) {
  const enrolment = await getOwnEnrolment(actor, tenantId);
  if (!enrolment) return null;
  const curriculum = await getCurriculumForEnrolment(actor, enrolment);
  if (!curriculum) return null;
  const options = await getEvidenceFormOptions(tenantId, enrolment.programmeId);

  const pickerObjectives = curriculum.domains.flatMap((domain) =>
    domain.objectives.map((objective) => ({
      id: objective.id,
      code: objective.code,
      title: objective.title,
      domainCode: domain.code,
      domainTitle: domain.title,
    })),
  );

  return {
    enrolment: enrolment as EnrolmentContext & { frameworkReleaseId: string | null },
    curriculum,
    options,
    pickerObjectives,
    frameworkLabel: `${curriculum.release.frameworkTitle} v${curriculum.release.version}`,
  };
}
