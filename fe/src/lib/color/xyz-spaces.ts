import { type Vec3 } from './math';

export interface XyzSpaceDefinition {
	key: string;
	label: string;
	observerKey: string;
	fieldSizeDeg: 2 | 10;
	defaultWhitePoint: Vec3; // [X, Y, Z] normalized such that Y = 1.0
}

export const XYZ_SPACES: Record<string, XyzSpaceDefinition> = {
	'cie1931-xyz-2deg': {
		key: 'cie1931-xyz-2deg',
		label: 'CIE 1931 2° Standard Observer Space',
		observerKey: 'ciexyz31-2deg',
		fieldSizeDeg: 2,
		defaultWhitePoint: [0.95047, 1.0, 1.08883] // D65
	},
	'cie1964-xyz-10deg': {
		key: 'cie1964-xyz-10deg',
		label: 'CIE 1964 10° Standard Observer Space',
		observerKey: 'ciexyz64-10deg',
		fieldSizeDeg: 10,
		defaultWhitePoint: [0.94811, 1.0, 1.07304] // D65 for 10°
	},
	'cie2006-xyzf-2deg': {
		key: 'cie2006-xyzf-2deg',
		label: 'CIE 2006 2° Physiological Space (X_F, Y_F, Z_F)',
		observerKey: 'stockman-sharpe-2deg',
		fieldSizeDeg: 2,
		defaultWhitePoint: [0.95047, 1.0, 1.08883]
	},
	'cie2006-xyzf-10deg': {
		key: 'cie2006-xyzf-10deg',
		label: 'CIE 2006 10° Physiological Space (X_F, Y_F, Z_F)',
		observerKey: 'stockman-sharpe-10deg',
		fieldSizeDeg: 10,
		defaultWhitePoint: [0.94811, 1.0, 1.07304]
	}
};
