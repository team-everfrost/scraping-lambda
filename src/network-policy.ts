import dns from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';

const blockedHostnames = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data.ec2.internal',
]);

export class NetworkPolicy {
  private readonly resolutions = new Map<string, Promise<void>>();

  async assertPublicURL(rawURL: string): Promise<URL> {
    const url = new URL(rawURL);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    ) {
      throw new Error('only credential-free http(s) URLs are allowed');
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (
      blockedHostnames.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new Error('private hostname is not allowed');
    }
    let resolution = this.resolutions.get(hostname);
    if (!resolution) {
      resolution = this.assertPublicHostname(hostname);
      this.resolutions.set(hostname, resolution);
    }
    await resolution;
    return url;
  }

  private async assertPublicHostname(hostname: string): Promise<void> {
    const addresses = net.isIP(hostname)
      ? [hostname]
      : (await dns.lookup(hostname, { all: true, verbatim: true })).map(
          (entry) => entry.address,
        );
    if (
      addresses.length === 0 ||
      addresses.some((address) => !isPublicAddress(address))
    ) {
      throw new Error('URL resolves to a private or reserved address');
    }
  }
}

export function isPublicAddress(address: string): boolean {
  let parsed = ipaddr.parse(address);
  if (
    parsed.kind() === 'ipv6' &&
    (parsed as ipaddr.IPv6).isIPv4MappedAddress()
  ) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  }
  return parsed.range() === 'unicast';
}
