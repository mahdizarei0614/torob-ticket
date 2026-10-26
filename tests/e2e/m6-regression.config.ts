import {defineConfig} from '@playwright/test';
import base from './m6.config';
export default defineConfig({...base,testMatch:['referral.spec.ts','guest-and-saved.spec.ts','admin-operations.spec.ts'],outputDir:process.env.M6_REGRESSION_DIR?process.env.M6_REGRESSION_DIR+'/artifacts':'../../docs/evidence/M6/regression/artifacts'});
