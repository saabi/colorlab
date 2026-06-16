import type { SpectralDataset } from '../types';

export const DATASET_LOADERS: Record<string, () => Promise<{ [key: string]: SpectralDataset }>> = {
	'cfb-vl-10deg-1nm': () => import('./cfb_vl_10deg_1nm'),
	'cfb-vl-2deg-1nm': () => import('./cfb_vl_2deg_1nm'),
	'ciexy2006-10deg': () => import('./ciexy2006_10deg_1nm'),
	'ciexy2006-2deg': () => import('./ciexy2006_2deg_1nm'),
	'ciexy31-1nm': () => import('./ciexy31_1nm'),
	'ciexy64-1nm': () => import('./ciexy64_1nm'),
	'ciexyz2006-10deg': () => import('./ciexyz2006_10deg_1nm'),
	'ciexyz2006-2deg': () => import('./ciexyz2006_2deg_1nm'),
	'ciexyz31-2deg': () => import('./ciexyz31_1nm'),
	'ciexyz64-10deg': () => import('./ciexyz64_1nm'),
	'ciexyzj-5nm': () => import('./ciexyzj_5nm'),
	'ciexyzjv-5nm': () => import('./ciexyzjv_5nm'),
	'demarco-pokorny-smith-1nm': () => import('./dpse_1nm'),
	'lens-density-1nm': () => import('./lens_density_1nm'),
	'macular-pigment-1nm': () => import('./macular_pigment_1nm'),
	'photopigment-absorbance-1nm': () => import('./photopigment_absorbance_1nm'),
	'sbrgb10deg-5nm': () => import('./sbrgb10deg_5nm'),
	'sbrgb2deg-5nm': () => import('./sbrgb2deg_5nm'),
	'scvle-1nm': () => import('./scvle_1nm'),
	'smb-cc-2deg-1nm': () => import('./smb_cc_2deg_1nm'),
	'smj10-loge': () => import('./smj10_loge'),
	'smj2-10-loge': () => import('./smj2_10_loge'),
	'smj2-loge': () => import('./smj2_loge'),
	'smith-pokorny-5nm': () => import('./sp_loge'),
	'stockman-sharpe-10deg': () => import('./ss10deg_1nm'),
	'stockman-sharpe-2deg': () => import('./ss2deg_1nm'),
	'vos-estevez-walraven-5nm': () => import('./vew_loge'),
	'vl10deg-1nm': () => import('./vl10deg_1nm'),
	'vl1924e-1nm': () => import('./vl1924e_1nm'),
	'vl-mesopic-m08-1nm': () => import('./vl_mesopic_m08_1nm'),
	'vl-mesopic-max-efficacy': () => import('./vl_mesopic_max_efficacy'),
	'vlje-5nm': () => import('./vlje_5nm'),
	'vme-1nm': () => import('./vme_1nm'),
	'vos-walraven-5nm': () => import('./vw_loge')
};

export async function loadDataset(key: string): Promise<SpectralDataset> {
	const loader = DATASET_LOADERS[key];
	if (!loader) {
		throw new Error(`Unknown spectral dataset key: ${key}`);
	}
	const module = await loader();
	// The export name matches the file base name (e.g. ss2deg_1nm)
	const exportKey = Object.keys(module).find(k => k !== 'default') || 'default';
	return module[exportKey] as SpectralDataset;
}
