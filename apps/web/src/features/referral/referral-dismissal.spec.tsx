import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import {ThemeProvider} from '@torob-ticket/ui';
import {catalog} from '../search/search-test-data';
import {ReferralDialog} from './referral-dialog';
import type {useReferralController} from './referral-controller';
it('a second background press cannot dismiss an active referral; Escape and explicit Cancel remain deliberate',async()=>{
 const cancel=vi.fn();const flow={state:{phase:'confirming'},cancel} as unknown as ReturnType<typeof useReferralController>;
 render(<ThemeProvider><ReferralDialog flow={flow} catalog={catalog}/></ThemeProvider>);const user=userEvent.setup();const dialog=screen.getByRole('dialog');
 const overlay=dialog.parentElement!.parentElement!;await user.click(overlay);expect(cancel).not.toHaveBeenCalled();dialog.focus();await user.keyboard('{Escape}');expect(cancel).toHaveBeenCalledTimes(1);await user.click(screen.getByRole('button',{name:'بستن و بازگشت به مقایسه'}));expect(cancel).toHaveBeenCalledTimes(2);
});
