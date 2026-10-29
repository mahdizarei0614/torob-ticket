attribute float emphasis;
attribute float hoverGlow;
attribute float phase;
attribute float geography;
varying float vEmphasis;
varying float vGeography;
varying vec2 vMapUv;
varying float vHover;
varying float vBreath;
varying float vLife;
uniform float pointSize;
uniform float atmosphere;
uniform float time;
uniform float unitsPerPixel;
uniform float dotDriftAmplitude;
uniform float centralLongitude;
void main() {
  vEmphasis = emphasis;
  vGeography = geography;
  vHover = hoverGlow;
  vBreath = geography > 0.5 ? livingDotGlow(position.xy+vec2(centralLongitude,0.0),time) : 0.66 + 0.19 * sin(time * 0.43 + phase) + 0.07 * sin(time * 0.19 - phase * 1.7);
  float legacySize = pointSize * (emphasis > 0.5 ? 2.4 : 1.0);
  float size = pointSize * (1.0 + min(emphasis,1.0) * (geography>0.5?0.25:0.55) + hoverGlow * 0.10);
  if (emphasis > 1.5) size = pointSize * 3.3;
  gl_PointSize = mix(legacySize,size,atmosphere);
  vec3 displayedPosition = position;
  vLife = 1.0;
  if (atmosphere > 0.5 && geography > 0.5) {
    vec3 particle = livingDotParticle(position.xy + vec2(centralLongitude,0.0), time, dotDriftAmplitude);
    vec2 flow=particleFlowOffset(position.xy+vec2(centralLongitude,0.0),unitsPerPixel,dotDriftAmplitude,30.0,particle.xy);
    displayedPosition.xy += (particle.xy+flow) * unitsPerPixel;
    vLife = particle.z;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displayedPosition, 1.0);
  vMapUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
}
