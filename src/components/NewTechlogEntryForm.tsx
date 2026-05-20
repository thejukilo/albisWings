'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createTechlogEntry, uploadTechlogAttachment, type Relevance } from '@/app/techlog/actions';

export function NewTechlogEntryForm({
  aircraftId,
  registration,
}: {
  aircraftId: string;
  registration: string;
}) {
  const router = useRouter();
  const [item, setItem]                 = useState('');
  const [relevance, setRelevance]       = useState<Relevance>('info');
  const [melCdlRef, setMelCdlRef]       = useState('');
  const [melCategory, setMelCategory]   = useState<'' | 'A' | 'B' | 'C' | 'D'>('');
  const [hobbs, setHobbs]               = useState('');
  const [files, setFiles]               = useState<File[]>([]);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // MEL fields are only meaningful when deferral is in play (i.e. relevance = not_flight_relevant)
  const showMel = relevance === 'not_flight_relevant';

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const arr = Array.from(list).filter(f => f.size <= 10 * 1024 * 1024);
    setFiles(prev => [...prev, ...arr]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item.trim()) {
      setError('Bitte eine Beschreibung eingeben.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createTechlogEntry({
        aircraftId,
        item: item.trim(),
        relevance,
        melCdlRef: showMel ? melCdlRef.trim() || undefined : undefined,
        melCategory: showMel && melCategory ? melCategory : null,
        hobbsAtRaise: hobbs ? Number(hobbs) : null,
      });
      if (!created.ok) {
        setError(created.error);
        setSubmitting(false);
        return;
      }

      // Upload files sequentially. If any fails, we keep the entry but show the warning.
      const failedUploads: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.set('file', file);
        fd.set('aircraftId', aircraftId);
        fd.set('entryId', created.id);
        const res = await uploadTechlogAttachment(fd);
        if (!res.ok) failedUploads.push(`${file.name}: ${res.error}`);
      }

      if (failedUploads.length > 0) {
        setError(`Eintrag gespeichert, aber Bilder fehlgeschlagen:\n${failedUploads.join('\n')}`);
        setSubmitting(false);
        return;
      }

      router.push(`/techlog/${aircraftId}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">
          Description <span className="text-red-600">*</span>
        </label>
        <textarea
          value={item}
          onChange={(e) => setItem(e.target.value)}
          rows={6}
          required
          placeholder="z.B. Linke Landeleuchte flackert beim Anlassen, geht nach 10s aus."
          className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800 focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Relevance <span className="text-red-600">*</span>
          </label>
          <select
            value={relevance}
            onChange={(e) => setRelevance(e.target.value as Relevance)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
          >
            <option value="info">For information only</option>
            <option value="not_flight_relevant">Not Flight Relevant</option>
            <option value="flight_relevant_aog">Flight Relevant (AOG)</option>
          </select>
          {relevance === 'flight_relevant_aog' && (
            <p className="text-[11px] text-red-700 mt-1">
              ⚠ Das Flugzeug wird sofort ausser Betrieb gesetzt und für Reservationen gesperrt.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            Hobbs bei Erfassung
          </label>
          <input
            type="number"
            step="0.1"
            value={hobbs}
            onChange={(e) => setHobbs(e.target.value)}
            placeholder="z.B. 1842.5"
            className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800 font-mono"
          />
        </div>

        {showMel && (
          <>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">MEL/CDL Reference</label>
              <input
                type="text"
                value={melCdlRef}
                onChange={(e) => setMelCdlRef(e.target.value)}
                placeholder="z.B. NCO.IDE.A.115(b)"
                className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">MEL Category</label>
              <select
                value={melCategory}
                onChange={(e) => setMelCategory(e.target.value as any)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
              >
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Upload Pictures</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-neutral-200 text-navy-800 rounded-sm hover:bg-neutral-300 text-sm"
          >
            Auswählen…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={onFilesPicked}
            className="hidden"
          />
          <span className="text-xs text-neutral-500">
            {files.length === 0 ? 'Keine Datei ausgewählt' : `${files.length} Datei(en) ausgewählt`}
          </span>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-xs bg-neutral-50 px-2 py-1.5 rounded">
                <span className="truncate">{f.name} <span className="text-neutral-500">· {(f.size/1024).toFixed(0)} KB</span></span>
                <button type="button" onClick={() => removeFile(i)} className="text-red-600 hover:text-red-800 ml-2">✕</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-neutral-500 mt-1">Max 10 MB pro Datei. Bilder oder PDFs.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-800 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
        <button
          type="button"
          onClick={() => router.push(`/techlog/${aircraftId}`)}
          className="px-4 py-2 border border-neutral-300 text-navy-800 rounded-sm hover:bg-neutral-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-navy-800 text-cream rounded-sm hover:bg-navy-900 disabled:opacity-50"
        >
          {submitting ? 'Speichere…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
