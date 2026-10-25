import type { Meta, StoryObj } from '@storybook/react-vite';
import { RouteLab } from '../route-lab';
const meta = { title: 'Graphics/Dotted geography and route scenes', component: RouteLab, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof RouteLab>;
export default meta;
export const RoutesAndLocation: StoryObj<typeof meta> = {};
