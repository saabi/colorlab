import { m3, type Mat3, type Vec3 } from './math';
import type { SpectralDataset } from './types';
import { ss2deg_1nm } from './data/ss2deg_1nm';
import { ciexyz31_1nm } from './data/ciexyz31_1nm';
import { loadDataset } from './data/loaders';

/**
 * Fast, non-negative linear interpolator for uniform 1nm or 5nm grids.
 * Clamps to 0.0 outside the tabulated range (which prevents tail divergence).
 */
export function interpolateDataset(dataset: SpectralDataset, nm: number, channel: string): number {
	const [minW, maxW] = dataset.wavelengthRange;
	if (nm < minW || nm > maxW) return 0.0;

	const idx = (nm - minW) / dataset.step;
	const vals = dataset.channels[channel];
	if (!vals) return 0.0;

	const i0 = Math.floor(idx);
	const i1 = Math.min(i0 + 1, vals.length - 1);
	const t = idx - i0;
	
	const val = (1 - t) * vals[i0] + t * vals[i1];
	return Math.max(val, 0.0); // Ensure non-negativity
}

export interface ObserverModel {
	key: string;
	label: string;
	fieldSizeDeg: 2 | 10;
	isPhysiological: boolean;
	dataset: SpectralDataset;
	toXyzMatrix: Mat3;
	toLmsMatrix: Mat3;
	evaluateLms(nm: number): Vec3;
	evaluateXyz(nm: number): Vec3;
}

// Canonical conversion matrices
export const MATRICES = {
	// Stockman & Sharpe 2° LMS -> CIE 2006 2° XYZ (also known as LMS2XYZ2 in pipeline.ts)
	ss2deg_to_xyz: [
		1.94735469, -1.41445123, 0.36476327,
		0.68990272, 0.34832189, 0.0,
		0.0, 0.0, 1.93485343
	] as Mat3,

	// Stockman & Sharpe 10° LMS -> CIE 2006 10° XYZ
	ss10deg_to_xyz: [
		1.93608643, -1.38318269, 0.35529452,
		0.69747209, 0.33413813, 0.0,
		0.0, 0.0, 1.88458925
	] as Mat3,

	// Smith-Pokorny LMS -> CIE 1931 2° XYZ
	smith_pokorny_to_xyz: [
		1.85907, -1.12708, 0.38508,
		0.69890, 0.30110, 0.0,
		0.0, 0.0, 1.0
	] as Mat3
};

/**
 * Creates an ObserverModel dynamically from a loaded SpectralDataset.
 */
export function createObserverModel(key: string, dataset: SpectralDataset): ObserverModel {
	if (key.includes('stockman-sharpe-2deg') || key.includes('ss2deg')) {
		const toXyz = MATRICES.ss2deg_to_xyz;
		const toLms = m3.inv(toXyz);
		return {
			key,
			label: dataset.label,
			fieldSizeDeg: 2,
			isPhysiological: true,
			dataset,
			toXyzMatrix: toXyz,
			toLmsMatrix: toLms,
			evaluateLms: (nm) => [
				interpolateDataset(dataset, nm, 'L'),
				interpolateDataset(dataset, nm, 'M'),
				interpolateDataset(dataset, nm, 'S')
			],
			evaluateXyz: (nm) => {
				const lms: Vec3 = [
					interpolateDataset(dataset, nm, 'L'),
					interpolateDataset(dataset, nm, 'M'),
					interpolateDataset(dataset, nm, 'S')
				];
				return m3.mulV(toXyz, lms);
			}
		};
	}

	if (key.includes('stockman-sharpe-10deg') || key.includes('ss10deg')) {
		const toXyz = MATRICES.ss10deg_to_xyz;
		const toLms = m3.inv(toXyz);
		return {
			key,
			label: dataset.label,
			fieldSizeDeg: 10,
			isPhysiological: true,
			dataset,
			toXyzMatrix: toXyz,
			toLmsMatrix: toLms,
			evaluateLms: (nm) => [
				interpolateDataset(dataset, nm, 'L'),
				interpolateDataset(dataset, nm, 'M'),
				interpolateDataset(dataset, nm, 'S')
			],
			evaluateXyz: (nm) => {
				const lms: Vec3 = [
					interpolateDataset(dataset, nm, 'L'),
					interpolateDataset(dataset, nm, 'M'),
					interpolateDataset(dataset, nm, 'S')
				];
				return m3.mulV(toXyz, lms);
			}
		};
	}

	// Standard XYZ CMFs (CIE 1931, CIE 1964)
	const is10Deg = key.includes('10deg') || key.includes('64');
	const toXyz: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // Identity since it is already in XYZ space
	const toLms = m3.inv(MATRICES.smith_pokorny_to_xyz); // Convert XYZ -> LMS via Smith-Pokorny
	
	return {
		key,
		label: dataset.label,
		fieldSizeDeg: is10Deg ? 10 : 2,
		isPhysiological: false,
		dataset,
		toXyzMatrix: toXyz,
		toLmsMatrix: toLms,
		evaluateLms: (nm) => {
			const xyz: Vec3 = [
				interpolateDataset(dataset, nm, 'X'),
				interpolateDataset(dataset, nm, 'Y'),
				interpolateDataset(dataset, nm, 'Z')
			];
			return m3.mulV(toLms, xyz);
		},
		evaluateXyz: (nm) => [
			interpolateDataset(dataset, nm, 'X'),
			interpolateDataset(dataset, nm, 'Y'),
			interpolateDataset(dataset, nm, 'Z')
		]
	};
}

// Eagerly loaded default observers
export const DEFAULT_OBSERVERS: Record<string, ObserverModel> = {
	'stockman-sharpe-2deg': createObserverModel('stockman-sharpe-2deg', ss2deg_1nm),
	'ciexyz31-2deg': createObserverModel('ciexyz31-2deg', ciexyz31_1nm)
};

/**
 * Asynchronously loads any registered observer dataset.
 */
export async function getObserverModel(key: string): Promise<ObserverModel> {
	if (key in DEFAULT_OBSERVERS) {
		return DEFAULT_OBSERVERS[key];
	}
	const dataset = await loadDataset(key);
	const model = createObserverModel(key, dataset);
	DEFAULT_OBSERVERS[key] = model;
	return model;
}
