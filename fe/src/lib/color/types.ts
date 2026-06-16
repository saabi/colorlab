export interface SpectralDataset {
	key: string;
	label: string;
	wavelengthRange: [number, number];
	step: number;
	channels: Record<string, number[]>;
}
