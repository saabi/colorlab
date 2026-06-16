#!/usr/bin/env python3
"""Normalize data/raw CSVs into data/processed/ and write SHA-256 checksums."""
import hashlib
import os
import re

NUMERIC_LINE = re.compile(r"^\s*[-+]?\d")
NAN_TOKENS = frozenset({"nan", "na", "-nan", "+nan", ""})


def normalize_cell(value: str) -> str:
    token = value.strip().lower()
    if token in NAN_TOKENS:
        return "0"
    return value.strip()


def parse_float(value: str) -> float:
    return float(normalize_cell(value))


def fmt_wavelength(value: str) -> str:
    return str(int(round(parse_float(value))))


def fmt_fixed(places: int, zero_dot_zero: bool = False):
    def format_value(value: str) -> str:
        number = parse_float(value)
        if zero_dot_zero and number == 0.0:
            return "0.0"
        return f"{number:.{places}f}"

    return format_value


def fmt_sci_upper(value: str) -> str:
    number = parse_float(value)
    if number == 0.0:
        return "0.0"
    return f"{number:.5E}"


def fmt_sci_lower(value: str) -> str:
    return f"{parse_float(value):.5e}"


def fmt_decimal(value: str) -> str:
    """Preserve general-purpose decimal strings without scientific notation."""
    number = parse_float(value)
    text = f"{number:.12f}".rstrip("0").rstrip(".")
    return text if text else "0"


def fmt_photopigment(value: str, wavelength: str) -> str:
    """Match committed mixed zero style: 0.00000 mid-spectrum, 0.0 from 616 nm."""
    number = parse_float(value)
    if number == 0.0 and int(round(parse_float(wavelength))) >= 616:
        return "0.0"
    return f"{number:.5f}"


FMT = {
    "w": fmt_wavelength,
    "f5": fmt_fixed(5),
    "f10": fmt_fixed(10),
    "f12": fmt_fixed(12),
    "f13": fmt_fixed(13),
    "se": fmt_sci_upper,
    "se_lower": fmt_sci_lower,
    "dec": fmt_decimal,
}

# Per-column formatters aligned with committed `836ed18` legibility where applicable.
FILE_COLUMN_FORMATS: dict[str, tuple[str, ...]] = {
    # CIE XYZ CMFs — 12 decimal fixed width
    "ciexyz31_1nm.csv": ("w", "f12", "f12", "f12"),
    "ciexyz64_1nm.csv": ("w", "f12", "f12", "f12"),
    "ciexyzj_5nm.csv": ("w", "f12", "f12", "f12"),
    "ciexyzjv_5nm.csv": ("w", "f12", "f12", "f12"),
    "ciexyz2006_2deg_1nm.csv": ("w", "se", "se", "se"),
    "ciexyz2006_10deg_1nm.csv": ("w", "se", "se", "se"),
    "ciexyz2006_2deg_01nm.csv": ("w", "se", "se", "se"),
    "ciexyz2006_10deg_01nm.csv": ("w", "se", "se", "se"),
    # Chromaticity — 5 decimal places (CIE tables)
    "ciexy31_1nm.csv": ("w", "f5", "f5", "f5"),
    "ciexy64_1nm.csv": ("w", "f5", "f5", "f5"),
    "ciexy2006_2deg_1nm.csv": ("w", "f5", "f5", "f5"),
    "ciexy2006_10deg_1nm.csv": ("w", "f5", "f5", "f5"),
    "ciexy2006_2deg_01nm.csv": ("w", "f5", "f5", "f5"),
    "ciexy2006_10deg_01nm.csv": ("w", "f5", "f5", "f5"),
    "smb_cc_2deg_1nm.csv": ("w", "f6", "f6", "f6"),
    # Stockman & Sharpe LMS — uppercase scientific, explicit 0.0
    "ss2deg_1nm.csv": ("w", "se", "se", "se"),
    "ss10deg_1nm.csv": ("w", "se", "se", "se"),
    "ss2deg_01nm.csv": ("w", "se", "se", "se"),
    "ss10deg_01nm.csv": ("w", "se", "se", "se"),
    # Luminous efficiency
    "vl1924e_1nm.csv": ("w", "f13"),
    "vl10deg_1nm.csv": ("w", "f12"),
    "vlje_5nm.csv": ("w", "f12"),
    "vme_1nm.csv": ("w", "f12"),
    "cfb_vl_2deg_1nm.csv": ("w", "se"),
    "cfb_vl_10deg_1nm.csv": ("w", "se"),
    "cfb_vl_2deg_01nm.csv": ("w", "se"),
    "cfb_vl_10deg_01nm.csv": ("w", "se"),
    "vl_mesopic_m08_1nm.csv": ("w", "f12"),
    "vl_mesopic_max_efficacy.csv": ("dec", "f2"),
    "scvle_1nm.csv": ("w", "f10"),
    # Prereceptoral / cone alternatives
    "lens_density_1nm.csv": ("w", "f5"),
    "macular_pigment_1nm.csv": ("w", "f5"),
    "photopigment_absorbance_1nm.csv": ("w", "f5p", "f5p", "f5p"),
    "sp_loge.csv": ("w", "dec", "dec", "dec"),
    "smj2_loge.csv": ("w", "dec", "dec", "dec"),
    "smj2_10_loge.csv": ("w", "dec", "dec", "dec"),
    "smj10_loge.csv": ("w", "dec", "dec", "dec"),
    "vw_loge.csv": ("w", "dec", "dec", "dec"),
    "vew_loge.csv": ("w", "dec", "dec", "dec"),
    "dpse_1nm.csv": ("w", "f4", "f4", "f4"),
    # Stiles & Burch RGB — lowercase scientific, 2-digit exponent
    "sbrgb2deg_5nm.csv": ("w", "se_lower", "se_lower", "se_lower"),
    "sbrgb10deg_5nm.csv": ("w", "se_lower", "se_lower", "se_lower"),
}

# Late-bind f4/f6 formatters
FMT["f4"] = fmt_fixed(4)
FMT["f6"] = fmt_fixed(6)
FMT["f2"] = fmt_fixed(2)


def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def format_row(parts: list[str], headers: list[str], filename: str) -> list[str]:
    column_formats = FILE_COLUMN_FORMATS.get(filename)
    if not column_formats or len(column_formats) != len(headers):
        return parts

    formatted = []
    wavelength = parts[0]
    for part, fmt_key in zip(parts, column_formats):
        if fmt_key == "f5p":
            formatted.append(fmt_photopigment(part, wavelength))
        else:
            formatted.append(FMT[fmt_key](part))
    return formatted


def process_file(src, dest, headers, filename):
    print(f"Processing {src} -> {dest} ...")
    if not os.path.exists(src):
        print(f"  Error: {src} does not exist.")
        return False

    with open(src, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    out_lines = [",".join(headers) + "\n"]
    for line in lines:
        line = line.strip()
        if not line or not NUMERIC_LINE.match(line):
            continue
        if line.lower().startswith("wavelength") or line.lower().startswith("wavenumber"):
            continue

        parts = [normalize_cell(p) for p in line.split(",")]
        parts = [p for p in parts if p != ""]

        if len(parts) > 0 and len(parts) < len(headers):
            while len(parts) < len(headers):
                parts.append("0")

        if len(parts) == len(headers):
            parts = format_row(parts, headers, filename)
            out_lines.append(",".join(parts) + "\n")
        elif len(parts) > len(headers):
            parts = format_row(parts[: len(headers)], headers, filename)
            out_lines.append(",".join(parts) + "\n")
        else:
            print(f"  Warning: skipping line due to column count: '{line[:80]}'")

    with open(dest, "w", encoding="utf-8") as f:
        f.writelines(out_lines)
    print("  Done.")
    return True


def main():
    os.makedirs("data/processed", exist_ok=True)
    os.makedirs("data/reports", exist_ok=True)

    # (filename, headers) — only CSV; Excel stays in data/raw/sb_individual/
    files_to_process = [
        ("ciexyz31_1nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyz64_1nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyzj_5nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyzjv_5nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyz2006_2deg_1nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyz2006_10deg_1nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexy31_1nm.csv", ["Wavelength", "x", "y", "z"]),
        ("ciexy64_1nm.csv", ["Wavelength", "x", "y", "z"]),
        ("ciexy2006_2deg_1nm.csv", ["Wavelength", "x", "y", "z"]),
        ("ciexy2006_10deg_1nm.csv", ["Wavelength", "x", "y", "z"]),
        ("smb_cc_2deg_1nm.csv", ["Wavelength", "Mb1", "Mb2", "Mb3"]),
        ("ss2deg_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("ss10deg_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("ss2deg_01nm.csv", ["Wavelength", "L", "M", "S"]),
        ("ss10deg_01nm.csv", ["Wavelength", "L", "M", "S"]),
        ("ciexyz2006_2deg_01nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyz2006_10deg_01nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexy2006_2deg_01nm.csv", ["Wavelength", "x", "y", "z"]),
        ("ciexy2006_10deg_01nm.csv", ["Wavelength", "x", "y", "z"]),
        ("cfb_vl_2deg_01nm.csv", ["Wavelength", "V"]),
        ("cfb_vl_10deg_01nm.csv", ["Wavelength", "V"]),
        ("sp_loge.csv", ["Wavelength", "L_logE", "M_logE", "S_logE"]),
        ("smj2_loge.csv", ["Wavelength", "L_logE", "M_logE", "S_logE"]),
        ("smj2_10_loge.csv", ["Wavelength", "L_logE", "M_logE", "S_logE"]),
        ("smj10_loge.csv", ["Wavelength", "L_logE", "M_logE", "S_logE"]),
        ("vw_loge.csv", ["Wavelength", "L_logE", "M_logE", "S_logE"]),
        ("vew_loge.csv", ["Wavelength", "L_logE", "M_logE", "S_logE"]),
        ("dpse_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("vl1924e_1nm.csv", ["Wavelength", "V"]),
        ("vl10deg_1nm.csv", ["Wavelength", "V"]),
        ("vlje_5nm.csv", ["Wavelength", "V"]),
        ("vme_1nm.csv", ["Wavelength", "V"]),
        ("cfb_vl_2deg_1nm.csv", ["Wavelength", "V"]),
        ("cfb_vl_10deg_1nm.csv", ["Wavelength", "V"]),
        ("vl_mesopic_m08_1nm.csv", ["Wavelength", "V"]),
        ("vl_mesopic_max_efficacy.csv", ["m", "Km_max"]),
        ("scvle_1nm.csv", ["Wavelength", "V_prime"]),
        ("lens_density_1nm.csv", ["Wavelength", "Density"]),
        ("macular_pigment_1nm.csv", ["Wavelength", "Density"]),
        ("photopigment_absorbance_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("sbrgb2deg_5nm.csv", ["Wavelength", "r", "g", "b"]),
        ("sbrgb10deg_5nm.csv", ["Wavelength", "r", "g", "b"]),
    ]

    checksums = []
    processed = 0
    missing = []

    for filename, headers in files_to_process:
        src = os.path.join("data/raw", filename)
        dest = os.path.join("data/processed", filename)

        if os.path.exists(src):
            checksums.append(f"{filename}: {get_sha256(src)}")
            if process_file(src, dest, headers, filename):
                processed += 1
        else:
            missing.append(filename)
            print(f"Skipping missing raw file: {src}")

    # Checksum individual-observer Excel (not processed to CSV)
    for xls in [
        "sb_individual/SB2_individual_CMF.xls",
        "sb_individual/SB10_corrected_indiv_CMFs.xls",
    ]:
        path = os.path.join("data/raw", xls)
        if os.path.exists(path):
            checksums.append(f"{xls}: {get_sha256(path)}")

    report_path = "data/reports/checksums.txt"
    print(f"Writing checksums to {report_path} ...")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(checksums) + "\n")

    print(f"Processed {processed}/{len(files_to_process)} CSV files.")
    if missing:
        print(f"Missing ({len(missing)}): {', '.join(missing)}")
    print("All tasks finished.")


if __name__ == "__main__":
    main()
