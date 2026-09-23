import { describe, expect, it } from 'vitest';
import { loginDestination, safeReturnPath } from './roles';

describe('role destinations', () => {
  it.each([
    ['SHOP', null, '/catalog'],
    ['SUPPLIER', null, '/supplier'],
    ['ADMIN', null, '/admin'],
    ['SHOP', '/checkout', '/checkout'],
    ['SUPPLIER', '/supplier/products', '/supplier/products'],
    ['ADMIN', '/admin/orders', '/admin/orders'],
    ['SHOP', '/admin', '/catalog'],
    ['SUPPLIER', '/checkout', '/supplier'],
    ['ADMIN', '/supplier/products', '/admin'],
  ] as const)('%s with %s routes to %s', (role, requested, expected) => {
    expect(loginDestination(role, requested)).toBe(expected);
  });

  it.each(['https://evil.example', '//evil.example/path', 'javascript:alert(1)'])('rejects unsafe return URL %s', value => {
    expect(safeReturnPath(value)).toBeNull();
  });
});
