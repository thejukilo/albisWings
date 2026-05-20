import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';

export const dynamic = 'force-dynamic';

export default async function TechlogIndex() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users').select('display_name').eq('id', user.id).maybeSingle();

  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, sort_order, manufacturer, model')
    .eq('active', true)
    .order('sort_order').order('registration');

  const { data: status } = await supabase
    .from('v_open_techlog')
    .select('aircraft_id, grounding_defects, open_defects, info_entries');

  const statusMap = new Map((status ?? []).map((s) => [s.aircraft_id, s]));

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="techlog" />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy-800">Techlog</h1>
          <p className="text-feather">Technischer Status der Flotte. Wählen Sie ein Flugzeug aus.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(aircraft ?? []).map((a) => {
            const s = statusMap.get(a.id);
            const grounding = s?.grounding_defects ?? 0;
            const open = s?.open_defects ?? 0;
            const isAog = grounding > 0;
            return (
              <Link
                key={a.id}
                href={`/techlog/${a.id}`}
                className={`block border rounded-sm p-4 transition-colors hover:shadow-sm ${
                  isAog ? 'border-red-300 bg-red-50 hover:bg-red-100'
                        : open > 0 ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                                   : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="reg-plate text-base">{a.registration}</span>
                  {isAog ? (
                    <span className="inline-block px-2 py-0.5 rounded-sm bg-red-700 text-white text-xs font-semibold uppercase">AOG</span>
                  ) : open > 0 ? (
                    <span className="inline-block px-2 py-0.5 rounded-sm bg-amber-200 text-amber-900 text-xs font-medium">offen</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-sm bg-emerald-200 text-emerald-900 text-xs font-medium">airworthy</span>
                  )}
                </div>
                <div className="text-sm text-neutral-700 mb-3">{a.manufacturer} {a.model}</div>
                <div className="text-xs text-neutral-600 space-y-0.5">
                  {grounding > 0 && <div><span className="font-semibold text-red-700">{grounding}</span> AOG-Eintrag{grounding !== 1 ? 'e' : ''}</div>}
                  {open > 0 && <div><span className="font-semibold text-amber-700">{open}</span> offene{open !== 1 ? 'r' : ''} Eintrag{open !== 1 ? 'e' : ''}</div>}
                  {grounding === 0 && open === 0 && <div className="text-emerald-700">Keine offenen Einträge</div>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
