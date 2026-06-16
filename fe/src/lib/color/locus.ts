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
	purpleLine: [[number, number], [number, number]]; // [start (380nm), end (780nm)]
}

/**
 * Generates the spectral locus curve and purple line boundary.
 * Clamped direct dataset values ensure the locus closes cleanly without tail loops.
 */
export function generateSpectralLocus(
	observer: ObserverModel,
	diagram: ChromaticityDiagram,
	startWavelength = 380,
	endWavelength = 780,
	step = 1
): SpectralLocus {
	const points: LocusPoint[] = [];
	for (let w = startWavelength; w <= endWavelength; w += step) {
		const lms = observer.evaluateLms(w);
		const xyz = observer.evaluateXyz(w);
		const chromaticity = diagram.project(xyz, lms);
		points.push({
			wavelength: w,
			xyz,
			lms,
			chromaticity
		});
	}

	const startPt = points[0].chromaticity;
	const endPt = points[points.length - 1].chromaticity;

	return {
		points,
		purpleLine: [startPt, endPt]
	};
}
