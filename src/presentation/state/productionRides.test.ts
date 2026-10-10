import { describe, expect, it } from 'vitest';
import type { Deployment } from '@domain/entities';
import { productionRides } from './selectors';

const now = new Date('2026-05-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const dep = (o: Partial<Deployment>): Deployment => ({
  id: 'd', repositoryId: 'r', environment: 'production', sha: 's', ref: 'main', createdAt: hoursAgo(1),
  status: 'success', changeRequestIds: [], triggeredById: 'ct-a', webUrl: '', ...o,
});

describe('productionRides', () => {
  it('running → deploying; recent success → celebrating', () => {
    expect(productionRides([dep({ status: 'running' })], now).get('ct-a')).toBe('deploying');
    expect(productionRides([dep({})], now).get('ct-a')).toBe('celebrating');
  });
  it('ignores old successes, failures, staging and unknown triggers', () => {
    expect(productionRides([dep({ createdAt: hoursAgo(49) })], now).size).toBe(0);
    expect(productionRides([dep({ status: 'failure' })], now).size).toBe(0);
    expect(productionRides([dep({ environment: 'staging' })], now).size).toBe(0);
    expect(productionRides([dep({ triggeredById: null, status: 'running' })], now).size).toBe(0);
  });
  it('uses the latest production deployment per person', () => {
    const rides = productionRides([dep({ createdAt: hoursAgo(5) }), dep({ status: 'failure', createdAt: hoursAgo(1) })], now);
    expect(rides.size).toBe(0);
  });
});
