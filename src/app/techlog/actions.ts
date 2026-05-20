'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type Relevance = 'info' | 'not_flight_relevant' | 'flight_relevant_aog';

export type CreateEntryInput = {
  aircraftId:   string;
  item:         string;
  relevance:    Relevance;
  melCdlRef?:   string;
  melCategory?: 'A' | 'B' | 'C' | 'D' | null;
  hobbsAtRaise?: number | null;
};

export type ActionResult =
  | { ok: true;  id: string }
  | { ok: false; error: string };

export async function createTechlogEntry(input: CreateEntryInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet' };

  if (!input.item || input.item.trim().length < 3) {
    return { ok: false, error: 'Bitte einen Eintrag beschreiben.' };
  }

  const { data, error } = await supabase
    .from('techlog_entries')
    .insert({
      aircraft_id:    input.aircraftId,
      raised_by:      user.id,
      item:           input.item.trim(),
      relevance:      input.relevance,
      state:          input.relevance === 'info' ? 'closed' : 'open',
      mel_cdl_ref:    input.melCdlRef?.trim() || null,
      mel_category:   input.melCategory ?? null,
      hobbs_at_raise: input.hobbsAtRaise ?? null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/techlog');
  revalidatePath(`/techlog/${input.aircraftId}`);
  revalidatePath('/');
  revalidatePath('/reservations');
  return { ok: true, id: data.id };
}

export type CloseEntryInput = {
  entryId:           string;
  aircraftId:        string;
  rectificationText: string;
  rectifiedHobbs?:   number | null;
};

export async function closeTechlogEntry(input: CloseEntryInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet' };

  if (!input.rectificationText || input.rectificationText.trim().length < 3) {
    return { ok: false, error: 'Bitte beschreiben, was unternommen wurde.' };
  }

  const { error } = await supabase
    .from('techlog_entries')
    .update({
      state:              'closed',
      rectified_by:       user.id,
      rectified_at:       new Date().toISOString(),
      rectification_text: input.rectificationText.trim(),
      rectified_hobbs:    input.rectifiedHobbs ?? null,
    })
    .eq('id', input.entryId);

  if (error) {
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return { ok: false, error: 'Sie haben keine Berechtigung, Einträge zu schliessen (Rolle "mechanic" oder "admin" erforderlich).' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/techlog');
  revalidatePath(`/techlog/${input.aircraftId}`);
  revalidatePath(`/techlog/${input.aircraftId}/${input.entryId}`);
  revalidatePath('/');
  revalidatePath('/reservations');
  return { ok: true, id: input.entryId };
}

export async function uploadTechlogAttachment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet' };

  const file       = formData.get('file') as File | null;
  const aircraftId = formData.get('aircraftId') as string | null;
  const entryId    = formData.get('entryId')    as string | null;

  if (!file || !aircraftId || !entryId) {
    return { ok: false, error: 'Datei oder Referenz fehlt.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'Datei zu gross (max 10 MB).' };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${aircraftId}/${entryId}/${randomUUID()}-${safeName}`;

  const bytes = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from('techlog-attachments')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: `Upload fehlgeschlagen: ${upErr.message}` };

  const { error: dbErr } = await supabase
    .from('techlog_attachments')
    .insert({
      techlog_entry_id: entryId,
      storage_path:     storagePath,
      original_name:    file.name,
      content_type:     file.type || 'application/octet-stream',
      size_bytes:       file.size,
      uploaded_by:      user.id,
    });
  if (dbErr) {
    await supabase.storage.from('techlog-attachments').remove([storagePath]);
    return { ok: false, error: `DB-Eintrag fehlgeschlagen: ${dbErr.message}` };
  }

  revalidatePath(`/techlog/${aircraftId}/${entryId}`);
  return { ok: true, id: storagePath };
}

export async function getAttachmentSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from('techlog-attachments')
    .createSignedUrl(storagePath, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}
