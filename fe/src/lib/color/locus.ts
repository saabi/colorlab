import { type Vec3 } from './math';
import { type ObserverModel } from './fundamentals';
import { type ChromaticityDiagram } from './diagrams';

export interface LocusPoint {
	wavelength: number;
	xyz: Vec3;
	lms: Vec3;
	chromaticity: [number, number];
}

export interface SpectralLocus {
	points: LocusPoint[];
	purpleLine: [[number, number], [number, number]]; // [short-wave endpoint, long-wave endpoint]
}

/**
 * Generates the spectral locus curve and purple line boundary.
 * The generated range is intersected with the observer's tabulated range so
 * out-of-range zero samples cannot become artificial purple-line endpoints.
 */
export function generateSpectralLocus(
	observer: ObserverModel,
	diagram: ChromaticityDiagram,
	startWavelength?: number,
	endWavelength?: number,
	step = 1
): SpectralLocus {
	const [dataMin, dataMax] = observer.dataset.wavelengthRange;
	const start = Math.max(startWavelength ?? dataMin, dataMin);
	const end = Math.min(endWavelength ?? dataMax, dataMax);
	const safeStep = Math.max(step, 1e-6);
	const points: LocusPoint[] = [];

	for (let w = start; w <= end + safeStep * 1e-6; w += safeStep) {
		const lms = observer.evaluateLms(w);
		const xyz = observer.evaluateXyz(w);
		const chromaticity = diagram.projectWavelength?.(w) ?? diagram.project(xyz, lms);
		points.push({
			wavelength: w,
			xyz,
			lms,
			chromaticity
		});
	}

	if (!points.length) {
		return {
			points,
			purpleLine: [
				[0, 0],
				[0, 0]
			]
		};
	}

	const startPt = points[0].chromaticity;
	const endPt = points[points.length - 1].chromaticity;

	return {
		points,
		purpleLine: [startPt, endPt]
	};
}
