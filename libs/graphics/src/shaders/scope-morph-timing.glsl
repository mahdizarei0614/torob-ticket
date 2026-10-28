// Shared with scope-morph.ts. Per-anchor timings keep landing and geography in phase.
uint scopeMorphHash(uint n) {
  n = (n ^ (n >> 16u)) * 0x7feb352du;
  n = (n ^ (n >> 15u)) * 0x846ca68bu;
  return n ^ (n >> 16u);
}
float scopeMorphSeed(vec2 center) {
  uint seed = scopeMorphHash(uint(int(floor(center.x * 128.0 + 0.5))) ^ scopeMorphHash(uint(int(floor(center.y * 128.0 + 0.5))) + 0x9e3779b9u));
  return float(seed & 65535u) / 65535.0;
}
vec2 scopeMorphTiming(float seed) {
  uint quantized = uint(floor(seed * 65535.0 + 0.5));
  float variation = float(scopeMorphHash(quantized ^ 0x51ed270bu) & 65535u) / 65535.0;
  return vec2(0.34 * seed, 0.32 + 0.20 * variation);
}
float scopeMorphParticleProgress(float progress, float seed) {
  vec2 timing = scopeMorphTiming(seed);
  return smoothstep(0.0, 1.0, (progress - timing.x) / timing.y);
}
float scopeMorphLandOpacity(float progress, float seed) {
  vec2 timing = scopeMorphTiming(seed);
  return smoothstep(0.0, 1.0, (progress - timing.x - timing.y) / 0.12);
}
