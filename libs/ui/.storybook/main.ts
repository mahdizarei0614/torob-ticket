import type { StorybookConfig } from '@storybook/react-vite';
// Root workspace asset/config; not a cross-project source import.
// eslint-disable-next-line @nx/enforce-module-boundaries
import tsconfig from '../../../tsconfig.base.json' with { type: 'json' };
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  staticDirs: ['../../../assets'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    config.resolve = {
      ...config.resolve,
      alias: Object.fromEntries(
        Object.entries(tsconfig.compilerOptions.paths).map(([name, paths]) => [
          name,
          decodeURIComponent(new URL('../../../' + paths[0], import.meta.url).pathname),
        ]),
      ),
    };
    return config;
  },
};
export default config;
