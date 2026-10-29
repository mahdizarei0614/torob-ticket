attribute vec2 targetPosition;
attribute vec2 endpointOpacity;
attribute vec4 sourceAnchor;
attribute vec4 targetAnchor;
attribute float seed;
uniform float morphProgress;
uniform float pointSize;
uniform float time;
uniform float dotDriftAmplitude;
uniform float unitsPerPixel;
uniform float centralLongitude;
uniform vec2 viewportCss;
uniform vec4 liveFrame;
varying float vOpacity;
varying float vGlow;
varying vec2 vMapUv;
vec3 liveEndpoint(vec2 basePosition, vec4 anchor, float opacity, bool target) {
  if (anchor.z < -1.5) {
    float amplitude=-anchor.z-2.0;
    vec2 before=livingDotOffset(anchor.xy,anchor.w,amplitude);
    vec2 now=livingDotOffset(anchor.xy,time,amplitude);
    return vec3(basePosition+(now-before)*0.65*2.0/viewportCss,opacity);
  }
  if (anchor.z < 0.0) return vec3(basePosition,opacity);
  float spacingPx=target?anchor.w/unitsPerPixel:anchor.w;
  float amplitude=target?min(dotDriftAmplitude,max(0.0,(spacingPx*2.5-2.0)/0.70710678118)):anchor.z;
  vec3 particle = livingDotParticle(anchor.xy,time,amplitude);
  if(target)basePosition=(anchor.xy-vec2(centralLongitude,0.0)-liveFrame.xy)/liveFrame.zw*2.0;
  vec2 repel = particleFlowOffset(anchor.xy,unitsPerPixel,amplitude,spacingPx,particle.xy);
  return vec3(basePosition+(particle.xy+repel)*2.0/viewportCss,opacity*particle.z);
}
void main() {
  float t = scopeMorphParticleProgress(morphProgress, seed);
  float drift = sin(3.14159265359*t)*(.12+seed*.24);
  float angle = seed*25.1327412287;
  vec3 from = liveEndpoint(position.xy,sourceAnchor,endpointOpacity.x,false);
  vec3 to = liveEndpoint(targetPosition,targetAnchor,endpointOpacity.y,true);
  vec2 positionOnScreen = mix(from.xy,to.xy,t)+vec2(cos(angle),sin(angle))*drift;
  vGlow=mix(livingDotGlow(sourceAnchor.xy,time),livingDotGlow(targetAnchor.xy,time),t);
  vOpacity = mix(from.z,to.z,t) * (1.0 - scopeMorphLandOpacity(morphProgress, seed));
  gl_Position = vec4(positionOnScreen,0.0,1.0);
  vMapUv = positionOnScreen * 0.5 + 0.5;
  gl_PointSize = pointSize;
}
