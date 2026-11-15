/**
 * THE TRAIN'S SHAPE: AN ENGINE AND TWO WAGONS (owner, 2026-11-15: "make it
 * look like an actual train"). One set of sizes for the plan's mark
 * (`TrainControl.tsx`) and the 3D view's model (`Viewer3D.tsx`), in
 * millimetres, so the two views show the same train.
 *
 *   travel ──▶
 *   [ wagon ]-[ wagon ]-[ engine > ]
 *       2         1          0        each car is placed by its own middle, on the track,
 *                                     `behindMm` back along the road from the engine's
 *
 * Inside the 26mm gauge, and no car longer than a small engine: each is
 * stood on the road as one rigid block, so a longer car would cut the
 * corners of a tight curve. The HEIGHT is not here: it is the app's one
 * measured train (`CLEARANCE.trainMm`), which the fit checks use.
 */

export interface TrainCar {
  readonly kind: 'engine' | 'wagon';
  readonly lengthMm: number;
  /** How far behind the engine's middle this car's middle rides, along the track. */
  readonly behindMm: number;
}

export const TRAIN_WIDTH_MM = 22;
const ENGINE_MM = 64;
const WAGON_MM = 46;
/** The coupling between two cars. */
const GAP_MM = 6;

export const TRAIN_CARS: readonly TrainCar[] = [
  { kind: 'engine', lengthMm: ENGINE_MM, behindMm: 0 },
  { kind: 'wagon', lengthMm: WAGON_MM, behindMm: ENGINE_MM / 2 + GAP_MM + WAGON_MM / 2 },
  { kind: 'wagon', lengthMm: WAGON_MM, behindMm: ENGINE_MM / 2 + GAP_MM + WAGON_MM + GAP_MM + WAGON_MM / 2 },
];

/** How far along the track the engine starts, so the wagons behind it start on the track too. */
export const TRAIN_HEAD_MM = TRAIN_CARS[TRAIN_CARS.length - 1]!.behindMm;
