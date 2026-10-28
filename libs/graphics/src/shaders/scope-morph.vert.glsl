attribute vec2 targetPosition;
attribute vec2 endpointOpacity;
attribute float seed;
uniform float morphProgress;
uniform float pointSize;
varying float vOpacity;
varying vec2 vMapUv;
void main() {
  float t = scopeMorphParticleProgress(morphProgress, seed);
  float drift = sin(3.14159265359*t)*(.12+seed*.24);
  float angle = seed*25.1327412287;
  vec2 positionOnScreen = mix(position.xy,targetPosition,t)+vec2(cos(angle),sin(angle))*drift;
  vOpacity = mix(endpointOpacity.x,endpointOpacity.y,t) * (1.0 - scopeMorphLandOpacity(morphProgress, seed));
  gl_Position = vec4(positionOnScreen,0.0,1.0);
  vMapUv = positionOnScreen * 0.5 + 0.5;
  gl_PointSize = pointSize;
}
