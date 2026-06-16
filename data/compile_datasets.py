#!/usr/bin/env python3
import os
import csv
import math

PROCESSED_DIR = "data/processed"
OUTPUT_DIR = "fe/src/lib/color/data"

METADATA = {
    "ss2deg_1nm.csv": {
        "key": "stockman-sharpe-2deg",
        "label": "Stockman & Sharpe (2000) 2° Cone Fundamentals",
    },
    "ss10deg_1nm.csv": {
        "key": "stockman-sharpe-10deg",
        "label": "Stockman & Sharpe (2000) 10° Cone Fundamentals",
    },
    "ciexyz31_1nm.csv": {
        "key": "ciexyz31-2deg",
        "label": "CIE 1931 2° XYZ CMFs",
    },
    "ciexyz64_1nm.csv": {
        "key": "ciexyz64-10deg",
        "label": "CIE 1964 10° XYZ CMFs",
    },
    "ciexyz2006_2deg_1nm.csv": {
        "key": "ciexyz2006-2deg",
        "label": "CIE 2006 2° physiological XYZ CMFs",
    },
    "ciexyz2006_10deg_1nm.csv": {
        "key": "ciexyz2006-10deg",
        "label": "CIE 2006 10° physiological XYZ CMFs",
    },
    "ciexy2006_2deg_1nm.csv": {
        "key": "ciexy2006-2deg",
        "label": "CIE 2006 2° physiological xy coordinates",
    },
    "ciexy2006_10deg_1nm.csv": {
        "key": "ciexy2006-10deg",
        "label": "CIE 2006 10° physiological xy coordinates",
    },
    "ciexyzj_5nm.csv": {
        "key": "ciexyzj-5nm",
        "label": "Judd 1951 modified CIE 1931 CMFs",
    },
    "ciexyzjv_5nm.csv": {
        "key": "ciexyzjv-5nm",
        "label": "Judd-Vos 1978 modified CIE 1931 CMFs",
    },
    "sbrgb2deg_5nm.csv": {
        "key": "sbrgb2deg-5nm",
        "label": "Stiles & Burch 1955 2° RGB CMFs",
    },
    "sbrgb10deg_5nm.csv": {
        "key": "sbrgb10deg-5nm",
        "label": "Stiles & Burch 1959 10° RGB CMFs",
    },
    "vl1924e_1nm.csv": {
        "key": "vl1924e-1nm",
        "label": "CIE 1924 photopic luminous efficiency V(λ)",
    },
    "vl10deg_1nm.csv": {
        "key": "vl10deg-1nm",
        "label": "CIE 10° photopic luminous efficiency V_10(λ)",
    },
    "vlje_5nm.csv": {
        "key": "vlje-5nm",
        "label": "Judd 1951 corrected photopic V(λ)",
    },
    "vme_1nm.csv": {
        "key": "vme-1nm",
        "label": "Judd-Vos photopic luminous efficiency V_M(λ)",
    },
    "cfb_vl_2deg_1nm.csv": {
        "key": "cfb-vl-2deg-1nm",
        "label": "CIE 2006 physiological photopic luminous efficiency V_F*(λ) 2°",
    },
    "cfb_vl_10deg_1nm.csv": {
        "key": "cfb-vl-10deg-1nm",
        "label": "CIE 2006 physiological photopic luminous efficiency V_F*(λ) 10°",
    },
    "vl_mesopic_m08_1nm.csv": {
        "key": "vl-mesopic-m08-1nm",
        "label": "Mesopic luminous efficiency V_mes(λ) (m=0.8)",
    },
    "scvle_1nm.csv": {
        "key": "scvle-1nm",
        "label": "CIE scotopic luminous efficiency V'(λ)",
    },
    "lens_density_1nm.csv": {
        "key": "lens-density-1nm",
        "label": "Stockman & Sharpe Lens Density",
    },
    "macular_pigment_1nm.csv": {
        "key": "macular-pigment-1nm",
        "label": "Stockman & Sharpe Macular Pigment Density",
    },
    "photopigment_absorbance_1nm.csv": {
        "key": "photopigment-absorbance-1nm",
        "label": "Stockman & Sharpe Photopigment Absorbance",
    },
    "sp_loge.csv": {
        "key": "smith-pokorny-5nm",
        "label": "Smith & Pokorny 1975 Cone Fundamentals (linear)",
    },
    "vw_loge.csv": {
        "key": "vos-walraven-5nm",
        "label": "Vos & Walraven 1971 Cone Fundamentals (linear)",
    },
    "vew_loge.csv": {
        "key": "vos-estevez-walraven-5nm",
        "label": "Vos, Estévez & Walraven 1990 Cone Fundamentals (linear)",
    },
    "dpse_1nm.csv": {
        "key": "demarco-pokorny-smith-1nm",
        "label": "DeMarco, Pokorny & Smith 1992 Cone Fundamentals (linear)",
    },
    "smj2_loge.csv": {
        "key": "smj2-loge",
        "label": "Stockman, MacLeod & Johnson 1993 2° Cone Fundamentals (linear)",
    },
    "smj2_10_loge.csv": {
        "key": "smj2-10-loge",
        "label": "Stockman, MacLeod & Johnson 10° Cone Fundamentals (CIE 10° adjusted) (linear)",
    },
    "smj10_loge.csv": {
        "key": "smj10-loge",
        "label": "Stockman, MacLeod & Johnson 1993 10° Cone Fundamentals (linear)",
    },
    "smb_cc_2deg_1nm.csv": {
        "key": "smb-cc-2deg-1nm",
        "label": "MacLeod-Boynton 2° Chromaticity coordinates",
    },
    "vl_mesopic_max_efficacy.csv": {
        "key": "vl-mesopic-max-efficacy",
        "label": "Mesopic maximum efficacy parameter",
    }
}

def clean_channel_name(name):
    # Strip suffixes like _logE or _loge or whitespace
    name = name.strip()
    for suff in ["_logE", "_loge", "_energy", "_quantal"]:
        if name.endswith(suff):
            name = name[:-len(suff)]
    return name

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    compiled_modules = []

    for filename in sorted(os.listdir(PROCESSED_DIR)):
        if not filename.endswith(".csv"):
            continue
        # Skip 0.1nm files to keep codebase compact
        if "01nm.csv" in filename:
            print(f"Skipping 0.1nm dataset: {filename}")
            continue

        src_path = os.path.join(PROCESSED_DIR, filename)
        name_without_ext = filename[:-4]
        
        meta = METADATA.get(filename, {})
        key = meta.get("key", name_without_ext.replace("_", "-"))
        label = meta.get("label", name_without_ext.replace("_", " ").title())

        print(f"Compiling {filename} -> {key} ...")

        with open(src_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)
            
            # Identify columns
            # Column 0 is always Wavelength
            channels = {clean_channel_name(h): [] for h in headers[1:]}
            channel_keys = [clean_channel_name(h) for h in headers[1:]]
            wavelengths = []

            is_log = "loge" in filename or filename == "dpse_1nm.csv"

            for row in reader:
                if not row:
                    continue
                w = float(row[0])
                wavelengths.append(w)
                for i, val_str in enumerate(row[1:]):
                    ch = channel_keys[i]
                    val = float(val_str)
                    if is_log:
                        val = 10.0 ** val
                    channels[ch].append(val)

        if not wavelengths:
            print(f"  Warning: No data in {filename}")
            continue

        min_w = int(round(wavelengths[0]))
        max_w = int(round(wavelengths[-1]))
        step = 1
        if len(wavelengths) > 1:
            step = int(round(wavelengths[1] - wavelengths[0]))

        # Format arrays cleanly
        channel_str_parts = []
        for ch, vals in channels.items():
            val_strs = []
            for v in vals:
                if v == 0.0:
                    val_strs.append("0")
                else:
                    # Use general format with 12 significant digits to preserve full precision
                    val_strs.append(f"{v:.12g}")
            
            val_list_str = ",\n\t\t\t".join(val_strs)
            channel_str_parts.append(f"'{ch}': [\n\t\t\t{val_list_str}\n\t\t]")

        channels_dict_str = ",\n\t\t".join(channel_str_parts)

        ts_filename = f"{name_without_ext}.ts"
        dest_path = os.path.join(OUTPUT_DIR, ts_filename)

        import json
        key_str = json.dumps(key)
        label_str = json.dumps(label)

        ts_content = f"""import type {{ SpectralDataset }} from '../types';

export const {name_without_ext}: SpectralDataset = {{
	key: {key_str},
	label: {label_str},
	wavelengthRange: [{min_w}, {max_w}],
	step: {step},
	channels: {{
		{channels_dict_str}
	}}
}};
"""
        with open(dest_path, "w", encoding="utf-8") as f:
            f.write(ts_content)

        compiled_modules.append({
            "key": key,
            "filename_base": name_without_ext,
            "var_name": name_without_ext,
            "label": label
        })

    # Generate loaders.ts
    loaders_path = os.path.join(OUTPUT_DIR, "loaders.ts")
    print(f"Generating loaders in {loaders_path} ...")

    import_mapping_parts = []
    for mod in compiled_modules:
        import_mapping_parts.append(f"\t'{mod['key']}': () => import('./{mod['filename_base']}')")

    import_mapping_str = ",\n".join(import_mapping_parts)

    loaders_content = f"""import type {{ SpectralDataset }} from '../types';

export const DATASET_LOADERS: Record<string, () => Promise<{{ [key: string]: SpectralDataset }}>> = {{
{import_mapping_str}
}};

export async function loadDataset(key: string): Promise<SpectralDataset> {{
	const loader = DATASET_LOADERS[key];
	if (!loader) {{
		throw new Error(`Unknown spectral dataset key: ${{key}}`);
	}}
	const module = await loader();
	// The export name matches the file base name (e.g. ss2deg_1nm)
	const exportKey = Object.keys(module).find(k => k !== 'default') || 'default';
	return module[exportKey] as SpectralDataset;
}}
"""
    with open(loaders_path, "w", encoding="utf-8") as f:
        f.write(loaders_content)

    print("Successfully compiled all datasets!")

if __name__ == "__main__":
    main()
