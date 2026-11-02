import { describe, expect, it } from 'vitest';
import { ANNOTATION_ENTRY_TRAVEL, annotationCrossesRoutes, placeAnnotations, type AnnotationBox, type AnnotationRoute } from './annotation-layout';
import { ItinerarySchema, PlaceSchema } from '@torob-ticket/contracts';
import { buildRouteGeometry, type IllustrativePath } from '../geo/route-geometry';
import { offsetPresentationPath, presentationRoutePaths } from '../geo/route-lanes';
import { projectPoint } from '../geo/projection';
import { fitPresentationBounds } from './camera-transition';
import fixtures from '../geo/route-geometry.fixture.json';

// Independent edge-orientation oracle, rather than reusing the layout's clipper.
function touchesRoute(box: AnnotationBox, routes: readonly AnnotationRoute[]) {
  return routes.some(route => {
    const margin = route.clearance ?? 15, left = box.left - margin, right = box.left + box.width + margin, top = box.top - margin, bottom = box.top + box.height + margin;
    const inside = (p: {x:number;y:number}) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
    const orientation = (a:{x:number;y:number}, b:{x:number;y:number}, c:{x:number;y:number}) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const edges = [[{x:left,y:top},{x:right,y:top}],[{x:right,y:top},{x:right,y:bottom}],[{x:right,y:bottom},{x:left,y:bottom}],[{x:left,y:bottom},{x:left,y:top}]] as const;
    return route.points.slice(1).some((b, index) => {
      const a = route.points[index]!;
      if (inside(a) || inside(b)) return true;
      return edges.some(([c,d]) => Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)) <= Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) && Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)) <= Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)) && orientation(a,b,c)*orientation(a,b,d) <= 0 && orientation(c,d,a)*orientation(c,d,b) <= 0);
    });
  });
}

describe('selected route annotation placement', () => {
  it('separates clustered international endpoints and repeated transfer stops without moving their anchors', () => {
    const anchors = [{ id: 'origin', x: 290, y: 170 }, { id: 'destination', x: 295, y: 169 }, { id: 'transfer-1', x: 292, y: 171 }, { id: 'transfer-2', x: 292, y: 171 }].map(point => ({ ...point, width: 132, height: 42 }));
    const actual = placeAnnotations(anchors, { width: 560, height: 500 });
    expect(actual.map(({ id, x, y }) => ({ id, x, y }))).toEqual(anchors.map(({ id, x, y }) => ({ id, x, y })));
    for (let i = 0; i < actual.length; i++) for (let j = i + 1; j < actual.length; j++) {
      const a = actual[i]!, b = actual[j]!;
      expect(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top).toBe(true);
    }
    expect(actual.some(item => item.leader !== null)).toBe(true);
    expect(placeAnnotations(anchors, { width: 560, height: 500 })).toEqual(actual);
  });

  it('keeps annotations inside a resized viewport when selected points touch its edges', () => {
    const anchors = [{ id: 'left', x: 1, y: 1 }, { id: 'right', x: 319, y: 219 }, { id: 'nearby', x: 318, y: 218 }].map(point => ({ ...point, width: 144, height: 42 }));
    for (const item of placeAnnotations(anchors, { width: 320, height: 220 })) {
      expect(item.left).toBeGreaterThanOrEqual(8); expect(item.top).toBeGreaterThanOrEqual(8);
      expect(item.left + item.width).toBeLessThanOrEqual(312); expect(item.top + item.height).toBeLessThanOrEqual(212);
    }
  });

  it('detects a stroke crossing a complete text box even when neither route vertex is inside it', () => {
    const route = [{ points: [{x:0,y:50},{x:500,y:50}] }];
    expect(annotationCrossesRoutes({left:140,top:45,width:100,height:36},route)).toBe(true);
    expect(annotationCrossesRoutes({left:140,top:75,width:100,height:36},route)).toBe(false);
    // Separate seam fragments must not create an edge through the whole world.
    expect(annotationCrossesRoutes({left:220,top:45,width:60,height:36},[{points:[{x:0,y:50},{x:25,y:50}]},{points:[{x:475,y:50},{x:500,y:50}]}])).toBe(false);
  });

  it('finds a real one-pixel route-free corridor instead of accepting a grid-resolution collision', () => {
    const routes = [20,100,180,260].map(y => ({points:[{x:0,y},{x:320,y}]}));
    const [label] = placeAnnotations([{id:'narrow-gap',x:160,y:100,width:120,height:40}],{width:320,height:280},routes);
    expect(touchesRoute({...label!,height:label!.height+ANNOTATION_ENTRY_TRAVEL},routes)).toBe(false);
    // Three equivalent one-pixel corridors exist. Placement may choose the
    // nearest clean one; the independent stroke oracle above is authoritative.
    expect([35,115,195].some(top => label!.top > top && label!.top < top + 1)).toBe(true);
  });

  it.each(['flight','train','bus'] as const)('keeps measured city/wait boxes and their entrance clear of actual %s geometry and both-direction lanes', mode => {
    const places = fixtures.places.map(place => PlaceSchema.parse(place));
    const examples = fixtures.scenarios.filter(scenario => scenario.itinerary.mode === mode);
    for (const example of examples) {
      const itinerary = ItinerarySchema.parse(example.itinerary);
      const outbound = buildRouteGeometry(itinerary,places,fixtures.paths as IllustrativePath[]);
      const inbound = itinerary.return ? buildRouteGeometry(itinerary,places,fixtures.paths as IllustrativePath[],'return') : [];
      const paths = presentationRoutePaths([...outbound,...inbound],inbound.length?outbound.length:undefined);
      const bounds = fitPresentationBounds(paths.map(path=>path.points));
      const ids = [...new Set([...itinerary.outbound.segments,...(itinerary.return?.segments??[])].flatMap(segment=>[segment.originPlaceId,segment.destinationPlaceId]))];
      for (const viewport of [{width:470,height:370},{width:560,height:500},{width:800,height:520}]) for (const zoom of [.85,1.1]) {
        const width = Math.max(bounds.width,bounds.height*viewport.width/viewport.height)/zoom;
        const frame = {...bounds,width,height:width*viewport.height/viewport.width};
        const pixel = ([x,y]:readonly number[]) => ({x:viewport.width*(.5+(x!-frame.x)/frame.width),y:viewport.height*(.5-(y!-frame.y)/frame.height)});
        const routes = paths.map(path=>({points:offsetPresentationPath(path,frame.width/viewport.width).map(pixel)}));
        const anchors = ids.map((id,index)=>({id,...pixel(projectPoint(places.find(place=>place.id===id)!.point)),width:index===1?196:132,height:index===1?48:44})).filter(point=>point.x>=0&&point.x<=viewport.width&&point.y>=0&&point.y<=viewport.height);
        const placed = placeAnnotations(anchors,viewport,routes);
        expect(placed.map(({id,x,y})=>({id,x,y}))).toEqual(anchors.map(({id,x,y})=>({id,x,y})));
        for (const label of placed) {
          expect(touchesRoute({...label,height:label.height+ANNOTATION_ENTRY_TRAVEL},routes),`${example.name} ${viewport.width} zoom${zoom} ${label.id}`).toBe(false);
          expect(label.left).toBeGreaterThanOrEqual(8);expect(label.top).toBeGreaterThanOrEqual(8);
          expect(label.left+label.width).toBeLessThanOrEqual(viewport.width-8);
          expect(label.top+label.height+ANNOTATION_ENTRY_TRAVEL).toBeLessThanOrEqual(viewport.height-8);
        }
        for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
          const a=placed[i]!,b=placed[j]!;
          expect(a.left+a.width<=b.left||b.left+b.width<=a.left||a.top+a.height+ANNOTATION_ENTRY_TRAVEL<=b.top||b.top+b.height+ANNOTATION_ENTRY_TRAVEL<=a.top).toBe(true);
        }
      }
    }
  });

  it('keeps a still-safe relative placement while the camera moves and remains finite if no clear box can fit', () => {
    const anchors=[{id:'city',x:220,y:180,width:120,height:40}],viewport={width:560,height:400};
    const route=[{points:[{x:0,y:200},{x:560,y:200}]}];
    const first=placeAnnotations(anchors,viewport,route);
    const shifted=placeAnnotations([{...anchors[0]!,x:222,y:181}],viewport,[{points:[{x:2,y:201},{x:562,y:201}]}],first);
    expect(shifted[0]!.left-first[0]!.left).toBeCloseTo(2);expect(shifted[0]!.top-first[0]!.top).toBeCloseTo(1);
    const impossible=placeAnnotations([{...anchors[0]!,width:900,height:900}],{width:120,height:90},[{points:[{x:0,y:45},{x:120,y:45}],clearance:80}]);
    expect(Object.values(impossible[0]!).filter(value=>typeof value==='number').every(Number.isFinite)).toBe(true);
  });
});
