import { describe, expect, it } from 'vitest';

import {
  captureLogHost,
  classifyPublicHttpsUrl,
  classifyRedirectTarget,
  dnsAnswerIsDenied,
} from './source-url';

describe('public HTTPS capture URL classification', () => {
  it('accepts a public https origin without credentials', () => {
    expect(classifyPublicHttpsUrl('https://washbodega.example/services')).toEqual({
      ok: true,
      href: 'https://washbodega.example/services',
      hostname: 'washbodega.example',
    });
  });
  it.each([
    ['http://example.test', 'protocol'],
    ['https://user:token@example.test', 'credentials'],
    ['https://example.test:8443', 'port'],
    ['https://127.0.0.1/', 'private_address'],
    ['https://localhost/', 'private_address'],
    ['https://10.0.0.4/', 'private_address'],
    ['https://192.168.1.8/', 'private_address'],
    ['https://169.254.169.254/', 'private_address'],
    ['https://[::1]/', 'private_address'],
    ['https://[::ffff:127.0.0.1]/', 'private_address'],
    ['https://[fc00::1]/', 'private_address'],
    ['https://metadata.google.internal/', 'private_address'],
    ['https://localhost./', 'private_address'],
    ['https://printer.local./', 'private_address'],
    ['https://[64:ff9b::7f00:1]/', 'private_address'],
    ['https://[::7f00:1]/', 'private_address'],
    ['https://[fec0::1]/', 'private_address'],
    ['https://[2002:7f00:1::]/', 'private_address'],
    [' javascript:alert(1)', 'malformed'],
  ])('denies %s as %s', (url, reason) => {
    expect(classifyPublicHttpsUrl(url)).toEqual({ ok: false, reason });
  });
  it('does not log userinfo or query tokens', () => {
    expect(captureLogHost('https://example.test/path?token=secret-value')).toBe('example.test');
  });
  it('rejects http downgrade and private redirect targets', () => {
    expect(classifyRedirectTarget('https://example.test/', 'http://example.test/next')).toEqual({
      ok: false,
      reason: 'protocol',
    });
    expect(classifyRedirectTarget('https://example.test/', 'https://127.0.0.1/')).toEqual({
      ok: false,
      reason: 'private_address',
    });
    expect(classifyRedirectTarget('https://example.test/a', '/b')).toMatchObject({
      ok: true,
      href: 'https://example.test/b',
    });
  });
  it('treats DNS answers that map to private space as denied', () => {
    expect(dnsAnswerIsDenied('8.8.8.8')).toBe(false);
    expect(dnsAnswerIsDenied('127.0.0.1')).toBe(true);
    expect(dnsAnswerIsDenied('::ffff:10.1.1.1')).toBe(true);
    expect(dnsAnswerIsDenied('64:ff9b::7f00:1')).toBe(true);
    expect(dnsAnswerIsDenied('2002:7f00:1::')).toBe(true);
    expect(dnsAnswerIsDenied('2001:4860:4860::8888')).toBe(false);
  });
});
