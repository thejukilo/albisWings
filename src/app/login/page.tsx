'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/aw-logo.png"
            alt="Albis Wings"
            width={180}
            height={120}
            priority
            className="mx-auto h-24 w-auto"
          />
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white border border-neutral-200 p-8"
        >
          <h1 className="text-2xl font-semibold text-navy-800 mb-1">Check-in</h1>
          <p className="text-feather mb-6">Anmeldung im Crew Portal</p>

          <label className="block mb-4">
            <span className="block text-sm text-navy-800 mb-1">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 focus:outline-none focus:border-navy-800 text-sm"
              placeholder="name@albiswings.ch"
            />
          </label>

          <label className="block mb-6">
            <span className="block text-sm text-navy-800 mb-1">Passwort</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-neutral-300 focus:outline-none focus:border-navy-800 text-sm"
            />
          </label>

          {error && (
            <div className="mb-4 border border-signal/40 bg-signal-50 px-3 py-2 text-sm text-signal-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-navy-800 text-white font-medium hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Anmeldung läuft…' : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Demo · Nicht für den operationellen Einsatz
        </p>
      </div>
    </div>
  );
}
