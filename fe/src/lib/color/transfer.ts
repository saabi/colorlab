export interface TransferCurve {
	enc(value: number): number;
	dec(value: number): number;
}

export const TRC = {
	srgb: {
		enc: (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055),
		dec: (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
	},
	g22: {
		enc: (v: number) => Math.pow(Math.max(v, 0), 1 / 2.2),
		dec: (v: number) => Math.pow(Math.max(v, 0), 2.2)
	},
	lin: {
		enc: (v: number) => v,
		dec: (v: number) => v
	}
} satisfies Record<string, TransferCurve>;
