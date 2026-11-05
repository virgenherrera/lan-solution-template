import type { NetworkInterfaceInfo } from 'node:os';
import { isIP } from 'node:net';

// Same shape the certificate builder accepts for a DNS name (labels of 1-63 chars, no leading or trailing dash).
export const HOST_NAME_PATTERN =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;

export interface WantedNamesInput {
  readonly hostname: string;
  // The OS facts are injected so this stays pure: callers pass os.hostname() and os.networkInterfaces().
  readonly interfaces: Readonly<Record<string, readonly NetworkInterfaceInfo[] | undefined>>;
  readonly extraNames: readonly string[];
}

export interface WantedNames {
  readonly dnsNames: string[];
  readonly ipAddresses: string[];
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

// The SAN set the leaf must cover (localhost, loopback, this host, its LAN IPv4 addresses, plus the configured extras).
// IPv6 addresses of the interfaces are left out on purpose: temporary (privacy) addresses rotate daily and would make the leaf look stale every day. A stable IPv6 goes in tls.extraNames.
export function wantedNames({ hostname, interfaces, extraNames }: WantedNamesInput): WantedNames {
  const dns = new Set<string>(['localhost']);
  const ips = new Set<string>(['127.0.0.1', '::1']);

  // A machine name that is not a valid DNS name (underscores, spaces) cannot go in a SAN: skip it instead of failing the start.
  if (HOST_NAME_PATTERN.test(hostname)) dns.add(hostname.toLowerCase());

  for (const addresses of Object.values(interfaces)) {
    for (const info of addresses ?? []) {
      // Older Node versions report the family as a number.
      const isV4 = info.family === 'IPv4' || (info.family as unknown) === 4;
      if (isV4 && !info.internal) ips.add(info.address);
    }
  }

  for (const name of extraNames) {
    if (isIP(name) !== 0) ips.add(name.toLowerCase());
    else dns.add(name.toLowerCase());
  }

  return { dnsNames: sortedUnique(dns), ipAddresses: sortedUnique(ips) };
}
