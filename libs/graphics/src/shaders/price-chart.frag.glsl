uniform vec4 chartGrid;
uniform vec4 chartMarker;
uniform vec4 background;
uniform vec4 priceLow;
uniform vec4 priceMid;
uniform vec4 priceHigh;
uniform float kind;
uniform float lineWidth;
uniform float ringWidth;
uniform float selectionRingWidth;
uniform float reveal;
uniform float revealStart;
uniform float revealEnd;
uniform float curveOpacity;
varying float vPricePosition;
varying float vStrokeSide;
varying float vMarkerRadius;
varying float vSelected;
varying float vPointBand;
varying float vChartX;
varying float vVisualOpacity;
void main() {
  vec4 price = vPricePosition <= 0.25 ? priceLow : vPricePosition >= 0.75 ? priceHigh : priceMid;
  vec4 color = kind > 2.5 ? chartMarker : kind > 1.5 ? chartGrid : price;
  float alpha = 1.0;
  if (kind > 0.5 && kind < 1.5) {
    price = vPointBand < 0.5 ? priceLow : vPointBand > 1.5 ? priceHigh : priceMid;
    float distanceToCenter = length(gl_PointCoord - 0.5) * (vMarkerRadius + 1.0) * 2.0;
    alpha = 1.0 - smoothstep(vMarkerRadius - 0.65, vMarkerRadius + 0.65, distanceToCenter);
    float innerRadius = vMarkerRadius - (vSelected > 0.5 ? 3.25 : 0.0);
    float innerRing = smoothstep(innerRadius - ringWidth - 0.65, innerRadius - ringWidth + 0.65, distanceToCenter) * (1.0 - smoothstep(innerRadius - 0.65, innerRadius + 0.65, distanceToCenter));
    color = mix(background, price, innerRing);
    if (vSelected > 0.5) {
      float selectedRing = smoothstep(vMarkerRadius - selectionRingWidth - 0.65, vMarkerRadius - selectionRingWidth + 0.65, distanceToCenter);
      color = mix(color, chartMarker, selectedRing);
    }
  } else {
    float solid = lineWidth * 0.5 / (lineWidth * 0.5 + 0.65);
    alpha = 1.0 - smoothstep(solid, 1.0, abs(vStrokeSide));
    if (kind > 2.5) alpha *= 0.3;
  }
  if (kind < 0.5 && reveal < 0.99999 && vChartX > mix(revealStart, revealEnd, reveal)) discard;
  if (kind < 1.5) alpha *= curveOpacity * vVisualOpacity;
  gl_FragColor = vec4(color.rgb, color.a * alpha);
  #include <colorspace_fragment>
}
