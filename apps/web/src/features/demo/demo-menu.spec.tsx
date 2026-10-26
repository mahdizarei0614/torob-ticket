import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {DemoMenu} from './demo-menu';
import {catalog,session} from '../search/search-test-data';
it('offers editable route intent without scenario, administration or destructive session controls',()=>{
 const preset=vi.fn();render(<DemoMenu catalog={catalog} session={{...session,scenario:'price-change'}} onPreset={preset}/>);fireEvent.click(screen.getByRole('button',{name:'سفرهای پیشنهادی'}));
 expect(screen.getByRole('dialog',{name:'سفرهای پیشنهادی'})).toBeTruthy();expect(screen.queryByText('price-change')).toBeNull();expect(screen.queryByRole('link',{name:/مدیریت/})).toBeNull();expect(screen.queryByRole('button',{name:/پاک کردن|شروع دوباره|بازنشانی/})).toBeNull();expect(screen.queryByText(/نمایشی|خیالی|شبیه‌سازی/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'پرواز داخلی · آغاز به پایان'}));expect(preset).toHaveBeenCalledTimes(1);expect(preset.mock.calls[0]?.[0]).toMatchObject({mode:'flight',scope:'domestic',originCityId:'a',destinationCityId:'b'});expect(screen.queryByRole('dialog')).toBeNull();
});
