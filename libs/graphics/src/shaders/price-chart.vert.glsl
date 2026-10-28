attribute vec2 strokeDirection;
attribute float strokeSide;
attribute float emphasis;
attribute float pointBand;
attribute float selectedMarker;
attribute float visualOpacity;
uniform vec2 viewport;
uniform float kind;
uniform float lineWidth;
uniform float selectedX;
uniform float pixelRatio;
uniform float markerRadius;
uniform float selectedRadius;
uniform float hoverGrowth;
varying float vPricePosition;
varying float vStrokeSide;
varying float vMarkerRadius;
varying float vSelected;
varying float vPointBand;
varying float vChartX;
varying float vVisualOpacity;
void main() {
  vPricePosition = (position.y + 0.65) / 1.3;
  vStrokeSide = strokeSide;
  vPointBand = pointBand;
  vChartX = position.x;
  vVisualOpacity = visualOpacity;
  vSelected = selectedMarker;
  vMarkerRadius = mix(markerRadius, selectedRadius, vSelected) + emphasis * hoverGrowth;
  vec2 point = position.xy;
  if (kind < 0.5 || kind > 1.5) {
    vec2 tangent = strokeDirection * viewport;
    vec2 normal = length(tangent) > 0.0 ? normalize(vec2(-tangent.y, tangent.x)) : vec2(0.0, 1.0);
    point += normal * strokeSide * (lineWidth * 0.5 + 0.65) * 2.0 / viewport;
  }
  gl_Position = vec4(point, 0.0, 1.0);
  gl_PointSize = (vMarkerRadius + 1.0) * 2.0 * pixelRatio;
}
