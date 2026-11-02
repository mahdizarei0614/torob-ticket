/** Owner-selected Compact Loop, production geometry with the requested paired leaves. */
export const compactLoop = {
  viewBox: '0 0 256 256',
  arch: 'M27 123C21 78 66 38 124 38C182 38 227 78 221 123C220 135 207 136 202 124C185 96 160 76 124 76C88 76 63 96 46 124C41 136 28 135 27 123Z',
  route: 'M71 185C84 205 102 215 124 215C146 215 164 205 177 185L201 201C184 232 157 242 124 242C91 242 64 232 47 201Z',
  endpoints: [49, 199],
  endpointY: 170,
  endpointRadius: 33,
  holeRadius: 13,
  leaves: [
    'M188 55C164 53 150 38 150 15C175 10 191 29 188 55Z',
    'M194 58C188 28 212 5 243 5C245 35 225 61 194 58Z',
  ],
} as const;
