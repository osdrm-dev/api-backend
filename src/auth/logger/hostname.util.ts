import os from 'os';

export function getHostname(): string {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (process.env.HOSTNAME && process.env.HOSTNAME.trim() !== '') {
      return process.env.HOSTNAME;
    }

    const systemHostname = os.hostname();
    if (systemHostname && systemHostname.trim() !== '') {
      return systemHostname;
    }

    return 'unknown-hostname';
  }

  return 'localhost';
}
