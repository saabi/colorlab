import type { SpectralDataset } from '../types';

export const vl_mesopic_max_efficacy: SpectralDataset = {
	key: "vl-mesopic-max-efficacy",
	label: "Mesopic maximum efficacy parameter",
	wavelengthRange: [0, 1],
	step: 0,
	channels: {
		'Km_max': [
			1700.13,
			1402.22,
			1181.84,
			1020.44,
			902.64,
			816.88,
			757.24,
			718.49,
			695.95,
			685.46,
			683
		]
	}
};
