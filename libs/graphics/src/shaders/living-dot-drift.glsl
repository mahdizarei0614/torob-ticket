// Output is CSS pixels, converted only at the map's current geographic scale.
uint livingDotHash(uint n) {
  n = (n ^ (n >> 16u)) * 0x7feb352du;
  n = (n ^ (n >> 15u)) * 0x846ca68bu;
  return n ^ (n >> 16u);
}
vec2 livingDotWaypoint(uint seed, int step) {
  uint point = livingDotHash(seed ^ (uint(step) * 0x9e3779b9u));
  return (vec2(float(point & 65535u), float(point >> 16u)) / 65535.0 * 2.0 - 1.0) * 0.70710678118;
}
vec3 livingDotParticle(vec2 center, float seconds, float amplitude) {
  if (amplitude <= 0.0) return vec3(0.0,0.0,1.0);
  uint seed = livingDotHash(uint(int(floor(center.x * 128.0 + 0.5))) ^ livingDotHash(uint(int(floor(center.y * 128.0 + 0.5))) + 0x9e3779b9u));
  float age = fract(seconds / (6.5 + 3.5 * float(seed & 65535u) / 65535.0)
    + float(livingDotHash(seed ^ 0x68bc21ebu) & 65535u) / 65535.0);
  float presence = smoothstep(0.0,0.18,age) * (1.0-smoothstep(0.68,0.94,age));
  float clock = seconds * (0.72 + 0.32 * float(seed & 65535u) / 65535.0) + float(seed >> 16u) / 65535.0 * 32.0;
  int step = int(floor(clock));
  float t = fract(clock), t2 = t*t, t3 = t2*t;
  // Convex cubic B-spline: continuous position/velocity/acceleration, no
  // repeating orbit or pauses at random waypoints, and no overshoot.
  vec4 weights = vec4(pow(1.0-t,3.0),3.0*t3-6.0*t2+4.0,-3.0*t3+3.0*t2+3.0*t+1.0,t3) / 6.0;
  vec2 drift = livingDotWaypoint(seed,step-1)*weights.x + livingDotWaypoint(seed,step)*weights.y
    + livingDotWaypoint(seed,step+1)*weights.z + livingDotWaypoint(seed,step+2)*weights.w;
  return vec3(drift * clamp(amplitude, 0.0, 9.0) * smoothstep(0.0, 0.9, seconds),presence);
}
vec2 livingDotOffset(vec2 center, float seconds, float amplitude) {
  return livingDotParticle(center,seconds,amplitude).xy;
}
