import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  const url = parse(domain);
  if (
    !url.hostname ||
    url.isIp ||
    !url.domain ||
    (!url.isIcann && !url.isPrivate)
  ) {
    return undefined;
  }
  return '.' + url.domain;
}
