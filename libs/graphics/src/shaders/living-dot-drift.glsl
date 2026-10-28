// Output is CSS pixels, converted only at the map's current geographic scale.
vec2 livingDotOffset(vec2 center, float seconds, float amplitude) {
  float phase = sin(center.x * 12.9898 + center.y * 78.233) * 6.28318530718;
  return vec2(
    .7 * sin(seconds * .27 + phase) + .2 * sin(seconds * .11 + phase * 1.9),
    .6 * cos(seconds * .23 + phase * 1.3) + .18 * sin(seconds * .13 - phase)
  ) * clamp(amplitude, 0.0, 1.0);
}
