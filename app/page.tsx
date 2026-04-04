'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CreateFlagForm from './components/create-flag-form';

interface Environment {
  id: string;
  name: string;
  slug: string;
}

interface Flag {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  states: Record<string, boolean>;
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    const res = await fetch('/api/flags');
    const data = await res.json();
    setFlags(data.flags ?? []);
    setEnvironments(data.environments ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function handleCreate(data: { name: string; key: string; description: string }) {
    const res = await fetch('/api/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to create flag');
    }
    setShowForm(false);
    await fetchFlags();
  }

  async function handleDelete(key: string) {
    setDeletingKey(key);
    await fetch(`/api/flags/${key}`, { method: 'DELETE' });
    setDeletingKey(null);
    await fetchFlags();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">{flags.length} flag{flags.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'New Flag'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8">
          <CreateFlagForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {flags.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-1">No flags yet</p>
          <p className="text-sm">Create your first flag to get started.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Key</th>
                {environments.map((env) => (
                  <th key={env.id} className="text-left px-4 py-3 font-medium text-gray-600 capitalize">
                    {env.name}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/flags/${flag.key}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {flag.name}
                    </Link>
                    {flag.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{flag.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{flag.key}</td>
                  {environments.map((env) => (
                    <td key={env.id} className="px-4 py-3">
                      {flag.states[env.slug] ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          On
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Off
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(flag.key)}
                      disabled={deletingKey === flag.key}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                    >
                      {deletingKey === flag.key ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
