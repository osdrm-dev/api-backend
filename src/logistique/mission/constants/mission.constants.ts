import { LgMissionStatus } from '@prisma/client';

// Mission statuses a trip (déplacement) may be linked to.
export const LINKABLE_MISSION_STATUSES: LgMissionStatus[] = [
  'CONFIRMED',
  'IN_PROGRESS',
];
