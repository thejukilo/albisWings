import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { NewTechlogEntryForm } from '@/components/NewTechlogEntryForm';

export const dynamic = 'force-dynamic';

export default async function NewTechlogEntryPage({
  params,
}: {
  params: Promise<{ aircraft_id: string }>;
}) {
  const { aircraft_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model')
    .eq('id', aircraft_id)
    .maybeSingle();
  if (!aircraft) notFound();

  return (
    <AppShell
      user={{
        name: me?.display_name ?? user.email ?? 'Member',
        initials: initialsOf(me?.first_name, me?.last_name, me?.display_name ?? user.email ?? 'Member'),
      }}
      tenantName="Albis Wings"
    >
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href={`/techlog/${aircraft_id}`} className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-3">
          ← Zurück zum Techlog
        </Link>

        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-navy-800">New Techlog Entry</h1>
          <p className="text-feather text-sm">
            Eintrag für <span className="font-mono">{aircraft.registration}</span> anlegen
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-sm p-6">
          <NewTechlogEntryForm aircraftId={aircraft_id} registration={aircraft.registration} />
        </div>
      </div>
    </AppShell>
  );
}

function initialsOf(first?: string | null, last?: string | null, fallback?: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return (fallback ?? '?').slice(0, 2).toUpperCase();
}
