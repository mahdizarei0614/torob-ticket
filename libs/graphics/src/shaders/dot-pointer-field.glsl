// Same CSS-pixel field as pointer-field.ts. One uniform, no trail loop per dot.
uniform vec4 pointerField;
vec2 dotPointerOffset(vec2 absolutePosition, float unit, float longitude, float amplitude, float spacingPx, vec2 drift, vec2 seedAnchor) {
  float radius = pointerField.z / unit;
  float budget = max(0.0,min(12.0,spacingPx*2.5-2.0-amplitude*0.70710678118));
  if (pointerField.w <= 0.0001 || radius <= 0.0 || budget <= 0.0) return vec2(0.0);
  vec2 delta = (absolutePosition-vec2(longitude,0.0)-pointerField.xy)/unit+drift;
  float distancePx = length(delta);
  if (distancePx >= radius) return vec2(0.0);
  uint seed = livingDotHash(uint(int(floor(seedAnchor.x*128.0+0.5))) ^ livingDotHash(uint(int(floor(seedAnchor.y*128.0+0.5)))+0x9e3779b9u));
  float angle = float(seed & 65535u)/65535.0*6.28318530718;
  vec2 direction = delta + vec2(cos(angle),sin(angle))*exp(-distancePx*distancePx*4.0)*0.35;
  return direction/sqrt(dot(direction,direction)+0.35*0.35)*budget*pointerField.w*(1.0-smoothstep(0.0,radius,distancePx));
}
