import os from 'os';

export function getHostname(): string {
    if (process.env.NODE_ENV === 'production') {
        return (
            process.env.HOSTNAME ||
            os.hostname() ||
            'unknown-hostname'
        );
    }

    return 'localhost';
}

