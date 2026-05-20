import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { TopNav } from '@/components/TopNav';
import { TechlogEntryActions } from '@/components/TechlogEntryActions';

export const dynamic = 'force-dynamic';

export default async function TechlogEntryPage({
  params,
}: {
  params: Promise<{ aircraft_id: string; entry_id: string }>;
}) {
  const { aircraft_id, entry_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration')
    .eq('id', aircraft_id)
    .maybeSingle();
  if (!aircraft) notFound();

  const { data: entry } = await supabase
    .from('techlog_entries')
    .select(`
      id, entry_no, item, relevance, state, mel_cdl_ref, mel_category,
      raised_at, raised_by, hobbs_at_raise,
      rectified_at, rectified_by, rectification_text, rectified_hobbs,
      raised_by_user:users!techlog_entries_raised_by_fkey(display_name),
      rectified_by_user:users!techlog_entries_rectified_by_fkey(display_name)
    `)
    .eq('id', entry_id)
    .maybeSingle();
  if (!entry) notFound();

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  const myRoles = (roles ?? []).map(r => r.role);
  const canClose = myRoles.some(r => ['admin','mechanic','cami','board'].includes(r))
                && entry.state === 'open'
                && entry.relevance !== 'info';

  const { data: attachments } = await supabase
    .from('techlog_attachments')
    .select('id, storage_path, original_name, content_type, size_bytes, uploaded_at')
    .eq('techlog_entry_id', entry_id)
    .order('uploaded_at');

  // Sign URLs for all attachments server-side
  const signedAttachments = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from('techlog-attachments')
        .createSignedUrl(a.storage_path, 60 * 5);
      return { ...a, signedUrl: data?.signedUrl ?? null };
    })
  );

  const isAog    = entry.relevance === 'flight_relevant_aog';
  const isInfo   = entry.relevance === 'info';
  const isClosed = entry.state === 'closed';

  const relevanceLabel =
    isAog ? 'Flight Relevant (AOG)' :
    isInfo ? 'For information only' :
    'Not Flight Relevant';

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="techlog" />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href={`/techlog/${aircraft_id}`} className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-3">
          ← Zurück zum Techlog
        </Link>

        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-navy-800">Eintrag #{entry.entry_no}</h1>
            <p className="text-feather text-sm">
              <span className="font-mono">{aircraft.registration}</span> ·
              eröffnet von {(entry.raised_by_user as any)?.display_name ?? '—'} am {format(new Date(entry.raised_at), 'dd.MM.yyyy HH:mm')}
            </p>
          </div>
          <span className={`inline-block px-3 py-1.5 rounded-sm text-xs font-medium border ${
            isClosed ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
              : isAog ? 'bg-red-100 text-red-900 border-red-200'
              : isInfo ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
              : 'bg-amber-100 text-amber-900 border-amber-200'
          }`}>
            {isClosed ? 'Close' : relevanceLabel}
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-sm p-6 space-y-5">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-1">Item</dt>
            <dd className="text-navy-800 whitespace-pre-wrap italic">{entry.item}</dd>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">Hobbs bei Erfassung</dt>
              <dd className="font-mono text-navy-800">{entry.hobbs_at_raise != null ? Number(entry.hobbs_at_raise).toFixed(1) : '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">Relevance</dt>
              <dd className="text-navy-800">{relevanceLabel}</dd>
            </div>
            {entry.mel_cdl_ref && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">MEL/CDL</dt>
                <dd className="text-navy-800 font-mono">{entry.mel_category && `${entry.mel_category} – `}{entry.mel_cdl_ref}</dd>
              </div>
            )}
          </dl>

          {signedAttachments.length > 0 && (
            <div className="pt-3 border-t border-neutral-200">
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Anhänge</dt>
              <ul className="space-y-1">
                {signedAttachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.signedUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-feather hover:text-navy-700 underline"
                    >
                      📎 {a.original_name}
                      <span className="text-neutral-400 text-[11px]">· {(a.size_bytes/1024).toFixed(0)} KB</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isClosed && entry.rectification_text && (
            <div className="pt-4 border-t border-neutral-200">
              <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-1">Action / Rectification</dt>
              <dd className="text-navy-800 whitespace-pre-wrap">{entry.rectification_text}</dd>
              <div className="text-xs text-neutral-500 mt-2">
                Signed by {(entry.rectified_by_user as any)?.display_name ?? '—'},
                {entry.rectified_at && ` ${format(new Date(entry.rectified_at), 'dd.MM.yyyy HH:mm')}`}
                {entry.rectified_hobbs != null && ` · Hobbs ${Number(entry.rectified_hobbs).toFixed(1)}`}
              </div>
            </div>
          )}

          {canClose && (
            <div className="pt-4 border-t border-neutral-200">
              <TechlogEntryActions entryId={entry_id} aircraftId={aircraft_id} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
