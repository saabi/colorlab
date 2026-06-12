import { createCamera } from './camera';

import type { AppState, ExplorerState } from './types';
import type { Camera } from './camera';

export const EXAMPLE_ID_PREFIX = 'example:';

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
		planeOutline: true,
		cylinderOutline: true,
		outlineDepthTest: true,
		surfaceGridAlpha: 0.25,
		solidAlpha: 1,
		hideAids: true,
		autoRotate: true,
		pinPalette: true,
		openSteps: ['gamut', 'sources'],
		guideNote: null,
		guideNotePlacement: 'sidebar',
		guideNoteDismissed: false,
		cvd: 'none',
		cvdSev: 1,
		theme: {
			lists: [[]],
			activeList: 0,
			selectedPoint: null,
			splineConstraint: 'free',
			splineSpace: 'oklab',
			gamutMap: 'none',
			curves: [],
			rawRows: [],
			rows: [],
			splineCurve: [],
			rawStops: [],
			steps: 5,
			arm: null,
			interpolateOn: true,
			placeOn: true,
			mode: 'spline',
			stops: [],
			arcLong: false,
			place: 'even',
			contrastMin: 1.5,
			contrastMax: 12,
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
			showPoints: true,
			showCurve: true,
			showStops: true,
			showPalette: true,
			grid: [],
			wcagBg: 'white'
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
		schemaVersion: 8,
		explorer: createExplorerDefaults(),
		camera: createCamera()
	};
	if (options.mobile) state.explorer.N = 128;
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
		name: 'Large Color Ramp',
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
				cvd: 'none',
				cvdSev: 1,
				guideNote:
					'This example builds a two-stop linear ramp in Oklch. The curve in the viewport is the interpolated path; the stops on the left are the placed palette swatches.\n\nOpen Interpolate and Place in the left pipeline to change how many steps are sampled, and try other interpolation spaces to see how the path bends through the solid.',
				guideNotePlacement: 'sidebar',
				guideNoteDismissed: false,
				theme: {
					lists: [
						[
							{ srgbLin: [0.002353332407759444, 0.0038332058213883316, 0.17366576656361682] },
							{ srgbLin: [0.7610351858718939, 0.9402926643687034, 0.15604940886754892] }
						]
					],
					splineConstraint: 'surface',
					splineSpace: 'oklch',
					steps: 11,
					mode: 'linear',
					arcLong: true,
					wcagBg: 'white'
				}
			},
			camera: {
				yaw: 1.355999999999995,
				pitch: 0.31399999999999906,
				dist: 1.5765230034944007,
				target: [0.05967533848186085, 0.09576925068959358, -0.09536971427920843],
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
				cvd: 'none',
				cvdSev: 1,
				guideNote:
					'Seven source points define a spline curve snapped to the sRGB surface. Spline mode follows the control polygon through Oklch rather than a straight chord.\n\nAdjust source points on the solid or in the Sources step, then compare linear vs spline under Interpolate.',
				guideNotePlacement: 'sidebar',
				guideNoteDismissed: false,
				theme: {
					lists: [
						[
							{ srgbLin: [0.15179282277131012, 0.9422662580510375, 0.9999999850358002] },
							{ srgbLin: [0.03671407394983858, 0.3714108130672565, 0.9929783888548199] },
							{ srgbLin: [0.028253499683098458, 0.012408419728036454, 0.24351054921984353] },
							{ srgbLin: [0.9423321273143955, 0.4093936585477751, 0.007526737942892326] },
							{ srgbLin: [0.6632663753802132, 0.7751983959873612, 0.09314133134117958] },
							{ srgbLin: [0.01902375407757991, 0.23677381868771052, 0.01243050656641337] },
							{ srgbLin: [1.460307339678016e-9, 0.020102723338920343, 0.0007882480511984311] }
						]
					],
					splineConstraint: 'surface',
					splineSpace: 'oklch',
					steps: 27,
					mode: 'spline',
					arcLong: true,
					wcagBg: 'white'
				}
			},
			camera: {
				yaw: -4.9800000000000075,
				pitch: 0.37999999999999917,
				dist: 2.221116252338258,
				target: [0.05770219796035286, 0.007643969273462504, -0.0987838640618481],
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
		name: 'Display P3 + shell',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				gamut: 'p3',
				shell: 'p3',
				cylSlice: true,
				cylRad: 0.35,
				guideNote:
					'The volume shows Display P3; the wire shell outlines the same boundary. The cylindrical clip reveals how much of P3 extends beyond sRGB along this view.\n\nSwitch gamuts or toggle the shell in Gamut & slice to compare standards.',
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
