"use server";

import {createHash} from "node:crypto";
import {registerDmsUpload,linkDmsDocumentToProject} from "./dms.actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DocumentType } from "@/lib/types/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, userId: user.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH DOCUMENTS FOR PROJECT
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocuments(projectId: string) {
  const { supabase, userId } = await requireUser();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const { data: links, error: linkError } = await supabase
    .from("dms_document_links")
    .select("document_id")
    .eq("user_id", userId)
    .eq("entity_type", "project")
    .eq("entity_id", projectId);
  if (linkError) throw new Error("Dokumentverknüpfungen konnten nicht geladen werden.");
  if (!links?.length) return data ?? [];
  const { data: linked, error: linkedError } = await supabase
    .from("documents")
    .select("*")
    .in(
      "id",
      links.map((link) => link.document_id),
    )
    .eq("user_id", userId)
    .eq("is_archived", false);
  if (linkedError) throw new Error(linkedError.message);
  return [
    ...new Map(
      [...(data ?? []), ...(linked ?? [])].map((document) => [
        document.id,
        document,
      ]),
    ).values(),
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD DOCUMENT
// Returns storage path for client-side upload + inserts DB record
// ─────────────────────────────────────────────────────────────────────────────

export async function createDocumentRecord(params: {
  projectId: string;
  displayName: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  documentType: DocumentType;
}) {
  const { supabase, userId } = await requireUser();

  if(!params.filePath.startsWith(`${userId}/`))return {error:'Ungültiger Speicherpfad.'};
  let bucket:'ema-dms'|'project-documents'='ema-dms';
  let downloaded=await supabase.storage.from(bucket).download(params.filePath);
  if(downloaded.error||!downloaded.data){bucket='project-documents';downloaded=await supabase.storage.from(bucket).download(params.filePath);}
  if(downloaded.error||!downloaded.data)return {error:'Originaldatei konnte nicht geprüft werden.'};
  if(downloaded.data.size>52_428_800)return {error:'Datei darf maximal 50 MB groß sein.'};
  const bytes=new Uint8Array(await downloaded.data.arrayBuffer());
  const hash=createHash('sha256').update(bytes).digest('hex');
  const result=await registerDmsUpload({projectId:params.projectId,displayName:params.displayName,fileName:params.fileName,filePath:params.filePath,fileSizeBytes:bytes.length,mimeType:params.mimeType||'application/octet-stream',documentType:params.documentType,sha256:hash,storageBucket:bucket});
  if(result.error)return {error:result.error};
  if(result.duplicate){
    const linked=await linkDmsDocumentToProject(result.duplicate.id,params.projectId);
    if(linked.error)return {error:linked.error};
    if(linked.document && (linked.document.file_path!==params.filePath||linked.document.storage_bucket!==bucket))await supabase.storage.from(bucket).remove([params.filePath]);
    return {success:true,documentId:result.duplicate.id,duplicate:true};
  }
  revalidatePath(`/projects/${params.projectId}/documents`);
  return {success:true,documentId:result.documentId};
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SIGNED URL for download
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocumentUrl(
  filePath: string,
  externalProvider?: string | null,
) {
  const { supabase, userId } = await requireUser();
  const { data: document, error: recordError } = await supabase.from("documents")
    .select("storage_bucket").eq("file_path", filePath).eq("user_id", userId)
    .eq("is_archived", false).limit(1).maybeSingle();
  if (recordError) return { error: "Dokumentzuordnung konnte nicht geprüft werden." };
  const bucketName = document?.storage_bucket || (externalProvider === "project-imports" ? "project-imports" : "project-documents");

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE DOCUMENT (soft delete)
// ─────────────────────────────────────────────────────────────────────────────

export async function archiveDocument(documentId: string, projectId: string) {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("documents")
    .update({ is_archived: true } as never)
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/documents`);
  return { success: true };
}
