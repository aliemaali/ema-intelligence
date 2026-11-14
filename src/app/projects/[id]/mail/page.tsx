import { isMailEnabled } from "@/lib/mail/model";
import { notFound } from "next/navigation";
import { mailSession } from "@/lib/mail/server";
import { visibleProject } from "@/lib/mail/extensions";
import { ProjectMail } from "@/components/mail/ProjectMail";
export default async function ProjectMailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isMailEnabled()) notFound();
  const { id } = await params;
  const session = await mailSession();
  await visibleProject(session, id);
  return <ProjectMail projectId={id} />;
}
