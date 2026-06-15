import { createCamera } from './camera';
import { MOBILE_STARTUP_TESS } from './mobile';
import { CURRENT_STATE_SCHEMA_VERSION } from './types';
import { DEFAULT_SURFACE_PROJECTION_PARAMS } from '$lib/color/boundary-project';
import { DEFAULT_GAMUT_MAP_PARAMS } from '$lib/color/gamut-map';

import type { AppState, ConstraintConfig, ExplorerState, ListPipeline, RampList, ThemeAnchor } from './types';
import type { SplineConstraint } from './types';
import type { SurfaceProjectionMethod } from '$lib/color/boundary-project';
import type { Camera } from './camera';

export const EXAMPLE_ID_PREFIX = 'example:';

function defaultConstraint(): ConstraintConfig {
	return {
		constraint: 'free',
		projection: 'adaptive-0.5',
		projectionParams: { ...DEFAULT_SURFACE_PROJECTION_PARAMS }
	};
}

/** Factory default per-list pipeline. */
export function defaultPipeline(): ListPipeline {
	return {
		mode: 'spline',
		splineSpace: 'oklab',
		interpolateOn: true,
		placeOn: true,
		place: 'even',
		arcLong: false,
		contrastMin: 1.5,
		contrastMax: 12,
		wcagBg: 'white',
		steps: 5,
		main: defaultConstraint(),
		expandOn: false,
		// Prefilled but inert (all axes 'off'); presets and the Expand panel set dirs.
		expandRows: {
			count: 2,
			hue: { delta: 180, dir: 'off' },
			chroma: { delta: 0, dir: 'off' },
			light: { delta: 0, dir: 'off' }
		},
		expandCols: {
			count: 5,
			hue: { delta: 40, dir: 'off' },
			chroma: { delta: 0.1, dir: 'off' },
			light: { delta: -0.32, dir: 'off' }
		},
		extension: defaultConstraint()
	};
}

/** Build a source ramp from anchors + pipeline overrides. `constraint`/`projection`
 *  are convenience shortcuts merged into `main`. */
function rampList(
	anchors: ThemeAnchor[],
	overrides: Partial<ListPipeline> & {
		constraint?: SplineConstraint;
		projection?: SurfaceProjectionMethod;
	} = {}
): RampList {
	const { constraint, projection, ...rest } = overrides;
	const pipeline = { ...defaultPipeline(), ...rest };
	if (constraint) pipeline.main = { ...pipeline.main, constraint };
	if (projection)
		pipeline.main = {
			...pipeline.main,
			projection,
			projectionParams: { ...pipeline.main.projectionParams, method: projection }
		};
	return { anchors, pipeline };
}

type PartialTheme = Partial<Omit<ExplorerState['theme'], 'stops'>>;
type ExamplePartial = {
	explorer?: Partial<Omit<ExplorerState, 'theme' | 'hover'>> & { theme?: PartialTheme };
	camera?: Partial<Camera>;
};

function createExplorerDefaults(): ExplorerState {
	return {
		spaceMode: 3,
		gamut: 'srgb',
		N: 256,
		autoPerformance: true,
		minAverageFps: 30,
		slice: false,
		planeMode: 'L',
		off: 0.5,
		az: 0,
		el: 90,
		eps: 0.0,
		floor: true,
		lines: true,
		cutAbove: true,
		cutBelow: false,
		cylSlice: false,
		cylRad: 0.2,
		shell: 'none',
		chromaticityOverlay: 'off',
		planeOutline: true,
		cylinderOutline: true,
		outlineDepthTest: true,
		surfaceGridAlpha: 0.25,
		solidAlpha: 1,
		hideAids: true,
		autoRotate: true,
		pinPalette: true,
		openSteps: ['gamut', 'ramp-builder', 'sources'],
		guideNote: null,
		guideNotePlacement: 'sidebar',
		guideNoteDismissed: false,
		cvd: 'none',
		cvdSev: 1,
		theme: {
			lists: [rampList([])],
			activeList: 0,
			selectedPoint: null,
			gamutMap: 'none',
			gamutMapParams: { ...DEFAULT_GAMUT_MAP_PARAMS },
			curves: [],
			rawRows: [],
			rows: [],
			splineCurve: [],
			rawStops: [],
			arm: null,
			stops: [],
			showPoints: true,
			showCurve: true,
			showStops: true,
			showPalette: true,
			grid: []
		},
		hover: null
	};
}

function cloneCamera(camera: Camera): Camera {
	return {
		yaw: camera.yaw,
		pitch: camera.pitch,
		dist: camera.dist,
		target: [camera.target[0], camera.target[1], camera.target[2]],
		fov: camera.fov
	};
}

export function cloneAppState(state: AppState): AppState {
	return JSON.parse(JSON.stringify(state)) as AppState;
}

export function createAppState(options: { mobile?: boolean } = {}): AppState {
	const state: AppState = {
		schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
		explorer: createExplorerDefaults(),
		camera: createCamera()
	};
	if (options.mobile) state.explorer.N = MOBILE_STARTUP_TESS;
	return state;
}

export function createExplorerState(): ExplorerState {
	return createAppState().explorer;
}

export function createExampleState(partial: ExamplePartial): AppState {
	const state = createAppState();
	if (partial.explorer) {
		const { theme, ...explorer } = partial.explorer;
		Object.assign(state.explorer, explorer);
		if (theme) Object.assign(state.explorer.theme, theme);
	}
	if (partial.camera) Object.assign(state.camera, partial.camera);
	state.camera = cloneCamera(state.camera);
	return state;
}

export const EXAMPLE_STATES = [
	{
		id: 'example:large-color-ramp',
		name: 'Warm Neutral Ramp',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				gamut: 'srgb',
				N: 256,
				slice: false,
				planeMode: 'L',
				off: 1,
				az: 0,
				el: 90,
				eps: 0,
				floor: true,
				lines: true,
				cutAbove: true,
				cutBelow: false,
				cylSlice: false,
				cylRad: 0.2,
				shell: 'none',
				planeOutline: true,
				cylinderOutline: true,
				outlineDepthTest: true,
				surfaceGridAlpha: 0.25,
				solidAlpha: 0.75,
				hideAids: false,
				cvd: 'none',
				cvdSev: 1,
				openSteps: ['gamut', 'ramp-builder', 'sources', 'interpolate'],
				guideNote:
					'A warm-neutral palette — dark brown to creamy light — spline-interpolated in Oklch. The warm undertone (R > G > B at each anchor) carries through consistently because Oklch\'s hue axis keeps it stable along the arc.\n\nThis is a practical starting point for UI neutrals and text containers. Try adding a mid-tone anchor to push the midpoint warmer or cooler, or enable Expand with a lightness offset to generate a tonal grid.',
				guideNotePlacement: 'sidebar',
				guideNoteDismissed: false,
				theme: {
					lists: [
						rampList(
							[
								{ srgbLin: [0.020, 0.010, 0.006] as [number, number, number] },
								{ srgbLin: [0.319, 0.214, 0.100] as [number, number, number] },
								{ srgbLin: [0.912, 0.869, 0.748] as [number, number, number] }
							],
							{ splineSpace: 'oklch', steps: 11, mode: 'spline', arcLong: false, wcagBg: 'white' }
						)
					]
				}
			},
			camera: {
				yaw: 1.356,
				pitch: 0.314,
				dist: 1.577,
				target: [0.06, 0.10, -0.10] as [number, number, number],
				fov: 0.7853981633974483
			}
		})
	},
	{
		id: 'example:spline-color-ramp',
		name: 'Spline Color Ramp',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				gamut: 'srgb',
				N: 256,
				slice: false,
				planeMode: 'L',
				off: 1,
				az: 0,
				el: 90,
				eps: 0,
				floor: true,
				lines: true,
				cutAbove: true,
				cutBelow: false,
				cylSlice: true,
				cylRad: 0.361,
				shell: 'none',
				planeOutline: true,
				cylinderOutline: true,
				outlineDepthTest: true,
				surfaceGridAlpha: 0.25,
				solidAlpha: 0.6,
				hideAids: false,
				cvd: 'none',
				cvdSev: 1,
				openSteps: ['gamut', 'ramp-builder', 'sources', 'interpolate'],
				guideNote:
					'Five anchors on the sRGB surface — blue, blue-violet, rose, orange, yellow — spanning a full hue arc in Oklch. Spline mode curves smoothly between them; switch to linear in Interpolate to see straight-chord connections between the same anchors.\n\nThe semi-transparent solid and cylindrical clip reveal the interpolated path. Try changing the interpolation space from Oklch to Oklab or sRGB to see how the arc bends differently in each coordinate system.',
				guideNotePlacement: 'sidebar',
				guideNoteDismissed: false,
				theme: {
					lists: [
						rampList(
							[
								{ srgbLin: [0, 0, 1] as [number, number, number] },
								{ srgbLin: [0.25, 0, 1] as [number, number, number] },
								{ srgbLin: [1, 0, 0.5] as [number, number, number] },
								{ srgbLin: [1, 0.25, 0] as [number, number, number] },
								{ srgbLin: [1, 1, 0] as [number, number, number] }
							],
							{
								constraint: 'surface-radial',
								splineSpace: 'oklch',
								steps: 11,
								mode: 'spline',
								arcLong: false,
								wcagBg: 'white'
							}
						)
					]
				}
			},
			camera: {
				yaw: 1.30,
				pitch: 0.38,
				dist: 2.22,
				target: [0.058, 0.008, -0.099] as [number, number, number],
				fov: 0.7853981633974483
			}
		})
	},
	{
		id: 'example:p3-oog-ramp',
		name: 'P3 OOG stops',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				gamut: 'p3',
				N: 256,
				slice: false,
				planeMode: 'L',
				off: 1,
				az: 0,
				el: 90,
				eps: 0,
				floor: true,
				lines: true,
				cutAbove: true,
				cutBelow: false,
				cylSlice: false,
				cylRad: 0.2,
				shell: 'srgb',
				planeOutline: true,
				cylinderOutline: true,
				outlineDepthTest: true,
				surfaceGridAlpha: 0.25,
				solidAlpha: 0.75,
				hideAids: false,
				cvd: 'none',
				cvdSev: 1,
				openSteps: ['gamut', 'ramp-builder', 'sources', 'gamut-map'],
				guideNote:
					'A ramp from a dark teal through a P3-exclusive vivid green — out of sRGB gamut — to a warm near-white. The Display P3 solid is the large volume; the sRGB wire shell marks the boundary.\n\nWith Gamut map at "None," the OOG stops export unchanged (orange badge in the Palette tab). Switch to "Clip (clamp)" or "Preserve chroma" to bring all stops into sRGB and compare how each method shifts hue and chroma.',
				guideNotePlacement: 'sidebar',
				guideNoteDismissed: false,
				theme: {
					lists: [
						rampList(
							[
								{ srgbLin: [0.010, 0.013, 0.046] as [number, number, number] },
								{ srgbLin: [-0.156, 0.721, 0.051] as [number, number, number] },
								{ srgbLin: [0.912, 0.869, 0.748] as [number, number, number] }
							],
							{ splineSpace: 'oklch', steps: 11, mode: 'linear', arcLong: false, wcagBg: 'white' }
						)
					],
					gamutMap: 'none'
				}
			},
			camera: { dist: 3.2 }
		})
	},
	{
		id: 'example:expand-grid',
		name: 'Tonal grid (Expand)',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				gamut: 'srgb',
				N: 256,
				slice: false,
				planeMode: 'L',
				off: 1,
				az: 0,
				el: 90,
				eps: 0,
				floor: true,
				lines: true,
				cutAbove: true,
				cutBelow: false,
				cylSlice: false,
				cylRad: 0.2,
				shell: 'none',
				planeOutline: true,
				cylinderOutline: true,
				outlineDepthTest: true,
				surfaceGridAlpha: 0.25,
				solidAlpha: 0.75,
				hideAids: false,
				cvd: 'none',
				cvdSev: 1,
				openSteps: ['gamut', 'ramp-builder', 'sources', 'expand'],
				guideNote:
					'Nine stops across a navy-to-sky-blue arc in Oklch, expanded to three lightness variants. The Expand row generator shifts every stop in Oklch L by ±0.20 (symmetric mode) — dark row, base row, light row.\n\nIncrease the row count or adjust the delta to widen the tonal spread. Try "ramp" direction instead of "sym" for a one-sided shift, or add a chroma axis to vary saturation across rows.',
				guideNotePlacement: 'sidebar',
				guideNoteDismissed: false,
				theme: {
					lists: [
						rampList(
							[
								{ srgbLin: [0.010, 0.030, 0.264] as [number, number, number] },
								{ srgbLin: [0.051, 0.462, 0.912] as [number, number, number] }
							],
							{
								splineSpace: 'oklch',
								steps: 9,
								mode: 'spline',
								arcLong: false,
								wcagBg: 'white',
								expandOn: true,
								expandRows: {
									count: 3,
									hue: { delta: 0, dir: 'off' },
									chroma: { delta: 0, dir: 'off' },
									light: { delta: 0.20, dir: 'sym' }
								}
							}
						)
					]
				}
			},
			camera: {
				yaw: 0.8,
				pitch: 0.35,
				dist: 1.8,
				target: [0.06, 0.10, -0.06] as [number, number, number],
				fov: 0.7853981633974483
			}
		})
	},
	{
		id: 'example:oklab-l-slice',
		name: 'Oklab L-slice',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				slice: true,
				planeMode: 'L',
				off: 0.55,
				cutAbove: true,
				hideAids: false,
				guideNote:
					'The slice control cuts the 3D solid with a plane at fixed Oklab L. You are looking at a 2D cross-section of all colors at one lightness level.\n\nDrag the slice offset in Gamut & slice, or Alt-drag in the viewport to move the plane interactively.',
				guideNotePlacement: 'overlay',
				guideNoteDismissed: false
			},
			camera: { yaw: 0.9, pitch: 0.35 }
		})
	},
	{
		id: 'example:p3-shell',
		name: 'Display P3 + sRGB shell',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				gamut: 'p3',
				shell: 'srgb',
				cylSlice: true,
				cylRad: 0.35,
				hideAids: false,
				guideNote:
					'The volume shows Display P3; the wire shell outlines the sRGB boundary. Colors between the cage and the solid surface are P3-only — not reproducible in sRGB.\n\nOrbit until the wire cage is visible inside the solid. The cylindrical clip removes low-chroma colors to reveal the P3-exclusive region clearly.',
				guideNotePlacement: 'overlay',
				guideNoteDismissed: false
			},
			camera: { dist: 3.2 }
		})
	}
];

export function isExampleId(id: string) {
	return id.startsWith(EXAMPLE_ID_PREFIX);
}
