/**
 * How far raised track may run between two supports: calibration F4, or
 * null while unmeasured. Null keeps the supports check off and the verdict
 * saying supports are not checked (engine/src/graph/supports.ts). Read from
 * the sheet, never typed in here.
 */

import { supportSpan } from './calibration.js';
import { MEASUREMENTS } from './measurements.js';

export const SUPPORT_SPAN_MM: number | null = supportSpan(MEASUREMENTS);
