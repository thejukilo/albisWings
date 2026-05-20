'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closeTechlogEntry } from '@/app/techlog/actions';

export function TechlogEntryActions({
  entryId,
  aircraftId,
}: {
  entryId: string;
  aircraftId: string;
}) {
  const router = useRouter();
  const [text, setText]         = useState('');
  const [hobbs, setHobbs]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (text.trim().length < 3) {
      setError('Bitte beschreiben, was unternommen wurde.');
      return;
    }
    setSubmitting(true);
    const res = await closeTechlogEntry({
      entryId,
      aircraftId,
      rectificationText: text.trim(),
      rectifiedHobbs: hobbs ? Number(hobbs) : null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-sm font-medium text-navy-800">Eintrag schliessen (Mechaniker-Sign-off)</h3>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">
          Rectification / Action <span className="text-red-600">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          required
          placeholder="z.B. Ventildeckeldichtung Zyl. 3 ersetzt. Probelauf 25 min, kein Ölaustritt mehr."
          className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
        />
      </div>

      <div className="w-48">
        <label className="block text-xs font-medium text-neutral-600 mb-1">Hobbs bei Sign-off</label>
        <input
          type="number"
          step="0.1"
          value={hobbs}
          onChange={(e) => setHobbs(e.target.value)}
          placeholder="z.B. 1832.1"
          className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800 font-mono"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-emerald-700 text-white rounded-sm hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? 'Schliesse…' : 'Eintrag schliessen'}
        </button>
        <p className="text-[11px] text-neutral-500">
          Beim Schliessen einer AOG-Eintragung wird das Flugzeug wieder freigegeben.
        </p>
      </div>
    </form>
  );
}
