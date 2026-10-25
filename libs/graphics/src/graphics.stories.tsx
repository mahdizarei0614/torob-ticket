import type { Meta, StoryObj } from '@storybook/react-vite';
import { GraphicsLab } from './graphics-lab';
const meta = { title: 'Graphics/Shared host laboratory', component: GraphicsLab, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof GraphicsLab>;
export default meta;
export const SharedViews: StoryObj<typeof meta> = {};
