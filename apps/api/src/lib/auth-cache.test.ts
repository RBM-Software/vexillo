import { describe, it, expect } from 'bun:test';
import { createAuthCache } from './auth-cache';
import type { AuthEntry } from './auth-cache';

function entry(environmentId: string): AuthEntry {
  return { environmentId, orgId: 'org-1', allowedOrigins: [], orgStatus: 'active' };
}

describe('createAuthCache — deleteByEnvironmentId', () => {
  it('evicts all keys belonging to the target environment', () => {
    const cache = createAuthCache();
    cache.set('key-a1', entry('env-a'));
    cache.set('key-a2', entry('env-a'));
    cache.set('key-b1', entry('env-b'));

    cache.deleteByEnvironmentId('env-a');

    expect(cache.get('key-a1')).toBeNull();
    expect(cache.get('key-a2')).toBeNull();
  });

  it('leaves keys from other environments intact', () => {
    const cache = createAuthCache();
    cache.set('key-a1', entry('env-a'));
    cache.set('key-b1', entry('env-b'));

    cache.deleteByEnvironmentId('env-a');

    expect(cache.get('key-b1')).toEqual(entry('env-b'));
  });

  it('is a no-op when the cache is empty', () => {
    const cache = createAuthCache();
    expect(() => cache.deleteByEnvironmentId('env-a')).not.toThrow();
  });

  it('is a no-op when no keys match the environment', () => {
    const cache = createAuthCache();
    cache.set('key-b1', entry('env-b'));

    cache.deleteByEnvironmentId('env-a');

    expect(cache.get('key-b1')).toEqual(entry('env-b'));
  });

  it('clear() still evicts all entries regardless of environment', () => {
    const cache = createAuthCache();
    cache.set('key-a1', entry('env-a'));
    cache.set('key-b1', entry('env-b'));

    cache.clear();

    expect(cache.get('key-a1')).toBeNull();
    expect(cache.get('key-b1')).toBeNull();
  });
});
