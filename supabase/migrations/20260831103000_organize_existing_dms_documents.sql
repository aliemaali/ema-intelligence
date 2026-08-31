-- Organize existing, still-unassigned DMS documents without moving files in Storage.
-- Existing manual folder assignments are preserved. The migration is idempotent.

create temporary table _dms_folder_plan on commit drop as
select
  d.id as document_id,
  d.user_id,
  case
    when d.document_type::text = 'nda'
      or d.display_name ilike '%nda%'
      then 'NDA'
    when d.is_data_room_archive
      or d.source_kind = 'data_room'
      then 'Datenräume'
    when d.display_name ilike '%wipperfürth%'
      or d.file_name ilike '%wipperfürth%'
      then 'Projekt Wipperfürth'
    when d.display_name ilike '%torgau%'
      or d.file_name ilike '%torgau%'
      then 'Projekt Torgau'
    when d.display_name ilike '%münzenberg%'
      or d.file_name ilike '%münzenberg%'
      or d.display_name ilike '%mÃ¼nzenberg%'
      or d.file_name ilike '%mÃ¼nzenberg%'
      then 'Projekt Münzenberg'
    when d.display_name ilike '%pomarico%'
      or d.file_name ilike '%pomarico%'
      then 'Projekt Pomarico'
    when d.display_name ilike '%delitzsch%'
      or d.file_name ilike '%delitzsch%'
      then 'Projekt Delitzsch'
    when d.display_name ilike '%alttrebbin%'
      or d.file_name ilike '%alttrebbin%'
      then 'Projekt Alttrebbin'
    when d.display_name ilike '%bess%portfolio%'
      or d.file_name ilike '%bess%portfolio%'
      then 'BESS Portfolio'
    when d.display_name ilike '%investoren%suchprofil%'
      or d.file_name ilike '%investoren%suchprofil%'
      or d.source_kind = 'contact'
      then 'Investoren'
    when d.display_name ilike '%rechenzentrum%'
      or d.file_name ilike '%rechenzentrum%'
      then 'Rechenzentrum'
    when d.display_name ilike '%checkliste%'
      or d.file_name ilike '%checkliste%'
      or d.display_name ilike '%aufnahmebogen%'
      or d.file_name ilike '%aufnahmebogen%'
      or d.source_kind = 'template'
      then 'Vorlagen & Checklisten'
    when d.source_kind = 'project'
      then 'Projektunterlagen'
    else 'Sonstige'
  end as folder_name
from public.documents d
where d.folder_id is null
  and d.is_archived = false;

insert into public.document_folders (user_id, name)
select distinct user_id, folder_name
from _dms_folder_plan
on conflict (user_id, name) do nothing;

update public.documents d
set folder_id = f.id
from _dms_folder_plan p
join public.document_folders f
  on f.user_id = p.user_id
 and f.name = p.folder_name
where d.id = p.document_id
  and d.user_id = p.user_id
  and d.folder_id is null;
