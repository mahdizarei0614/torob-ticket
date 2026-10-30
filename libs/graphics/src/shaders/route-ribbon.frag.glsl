uniform vec4 route;
uniform vec4 routeMuted;
uniform vec4 highlight;
uniform vec4 background;
uniform float reveal;
uniform float travel;
uniform float stopGlow;
uniform float strandOpacity;
uniform float headLength;
uniform float tailLength;
uniform float directionSplit;
uniform float directionRoundTrip;
uniform float directionPhase;
uniform vec2 directionCount;
uniform vec2 directionOpacity;
varying float vProgress;
varying float vSide;
varying float vKind;
varying float vMode;
varying float vLeg;
void main() {
  if (vProgress > reveal) discard;
  float side = abs(vSide);
  float core;
  float halo = exp(-side * side * 5.0) * 0.14;
  if (vMode > 1.5) {
    // A soft road edge and restrained broken center line.
    float edge = 1.0 - smoothstep(0.055, 0.15, abs(side - 0.38));
    float center = (1.0 - smoothstep(0.025, 0.09, side)) * step(0.4, fract(vProgress * 58.0));
    core = edge * 0.68 + center * 0.64 + (1.0 - smoothstep(0.33, 0.44, side)) * 0.15;
  } else if (vMode > 0.5) {
    core = 1.0 - smoothstep(0.045, 0.15, abs(side - 0.36));
  } else {
    core = 1.0 - smoothstep(0.055, 0.21, side);
  }
  // The tail exists only behind the moving head, making direction legible.
  // Lengths are updated in CSS pixels as the camera eases or zooms.
  float behind = travel - vProgress;
  float tail = exp(-max(0.0,behind) / max(tailLength,0.0001) * 2.5) * (1.0 - smoothstep(0.0,headLength * 0.8,-behind)) * strandOpacity;
  float head = exp(-pow(behind / max(headLength,0.0001),2.0)) * strandOpacity;
  float ray = exp(-side * side * 25.0);
  float spark = exp(-pow(behind / max(headLength * 0.32,0.0001),2.0)) * exp(-side * side * 2.5) * strandOpacity;
  float flare = tail * ray * 0.88 + head * (0.8 + stopGlow * 1.4) + spark * (0.5 + stopGlow * 0.7);
  // Both supplied legs travel toward increasing canonical progress. Their own
  // geometry order supplies the physical outbound/return direction.
  float returning = step(0.5, vLeg) * directionRoundTrip;
  float legStart = returning * directionSplit;
  float legEnd = mix(mix(1.0, directionSplit, directionRoundTrip), 1.0, returning);
  float legLength = max(0.0001, legEnd - legStart);
  float local = (vProgress - legStart) / legLength;
  float count = mix(directionCount.x, directionCount.y, returning);
  float opacity = mix(directionOpacity.x, directionOpacity.y, returning);
  float along = fract(local * count - directionPhase + 0.5) - 0.5;
  float tapered = smoothstep(-0.43, -0.035, along) * (1.0 - smoothstep(0.015, 0.075, along));
  float chevronDistance = (along + side * 0.06) / 0.026;
  float chevron = exp(-chevronDistance * chevronDistance) * (1.0 - smoothstep(0.35, 0.74, side));
  float endFade = smoothstep(0.0, 0.035, local) * (1.0 - smoothstep(0.965, 1.0, local));
  float directional = (tapered * exp(-side * side * 5.0) * 0.48 + chevron * 0.68) * opacity * endFade;
  vec4 base = vKind > 0.5 ? routeMuted : route;
  if (returning > 0.5) base.rgb = vKind > 0.5 ? mix(routeMuted.rgb, route.rgb, 0.24) : mix(route.rgb, routeMuted.rgb, 0.46);
  vec3 light = mix(base.rgb, highlight.rgb, clamp(flare, 0.0, 1.0));
  // The same semantic palette keeps the cue legible in light and dark themes.
  float brighterContrast = step(distance(base.rgb, background.rgb), distance(highlight.rgb, background.rgb));
  vec3 directionColor = mix(base.rgb, highlight.rgb, brighterContrast * 0.75);
  light = mix(light, directionColor, clamp(directional * 0.7, 0.0, 0.65));
  float alpha = clamp(core * 0.76 + halo + tail * ray * 0.7 + head * ray * 0.8 + spark * (0.52 + stopGlow * 0.4) + directional * 0.38, 0.0, 1.0) * base.a;
  gl_FragColor = vec4(light, alpha);
  #include <colorspace_fragment>
}
