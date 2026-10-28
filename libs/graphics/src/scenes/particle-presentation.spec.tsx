import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { StaticMap } from './scene-drawing';

it('keeps decorative major cities in the geography palette while preserving selected semantic city markers',()=>{
  const point={longitude:51.4,latitude:35.7};
  const view=render(<svg><StaticMap dots={[point]} majorCities={[point]} markers={[{id:'origin',name:'Origin',point,kind:'city',role:'origin'}]} segments={[]} context={{centralLongitude:0}} frame={{x:54,y:33,width:22,height:17}}/></svg>);
  const circles=[...view.container.querySelectorAll('circle')];
  expect(circles).toHaveLength(3);
  expect(circles[0]?.getAttribute('fill')).toBe('var(--scene-dot)');
  expect(circles[1]?.getAttribute('fill')).toBe('var(--scene-dot)');
  expect(circles[1]?.getAttribute('opacity')).toBe('.7');
  expect(circles[2]?.getAttribute('fill')).toBe('var(--focus)');
});
