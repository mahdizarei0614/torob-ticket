uniform vec4 chartGrid;
uniform vec4 priceLow;
uniform vec4 priceMid;
uniform vec4 priceHigh;
uniform float kind;
varying float vPricePosition;
void main() {
  vec4 color = kind > 1.5 ? chartGrid : vPricePosition <= 0.25 ? priceLow : vPricePosition >= 0.75 ? priceHigh : priceMid;
  gl_FragColor = color;
  #include <colorspace_fragment>
}
