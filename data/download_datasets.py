#!/usr/bin/env python3
"""Download spectral/observer datasets into data/raw/. See _docs/spectral-dataset-sources.md."""
import os
import urllib.parse
import urllib.request

CVRL = "http://www.cvrl.org/"
CIE = "https://files.cie.co.at/"

# Source selection policy (see data/reports/source-verification.md):
# - CIE GET for official CMFs / V(lambda) where sampling matches CVRL (1 nm).
# - CVRL POST for Stockman & Sharpe LMS: CIE_lms_cf_* is 5 nm only (89 rows);
#   CVRL conerequest_ss* at Cone_steps=1 is true 1 nm (441 rows).
# - CVRL POST for historical/corrected CMFs and log-energy cone tables.
# - CVRL fine (0.1 nm) for SS LMS, CIE 2006 XYZ_F/chromaticity, physiological V(λ).
# - CIE mesopic: Vmes example at m=0.8 + Km,max vs m; other m via CIE 018:2019 Eq. (2).


def make_dirs():
    os.makedirs("data/raw", exist_ok=True)
    os.makedirs("data/raw/sb_individual", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)
    os.makedirs("data/reports", exist_ok=True)


def get_download(url, output_path):
    print(f"Downloading {url} -> {output_path} ...")
    try:
        with urllib.request.urlopen(url) as response:
            content = response.read()
            if len(content) < 100:
                print(f"  Warning: small response ({len(content)} bytes) for {output_path}")
            with open(output_path, "wb") as f:
                f.write(content)
        print("  Done.")
    except Exception as e:
        print(f"  Error downloading {output_path}: {e}")


def post_download(url, data_dict, output_path):
    print(f"Downloading {url} -> {output_path} ...")
    data = urllib.parse.urlencode(data_dict).encode("utf-8")
    req = urllib.request.Request(url, data=data)
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read()
            if b"404 Not Found" in content or len(content) < 100:
                print(f"  Warning: small or error response ({len(content)} bytes) for {output_path}")
            with open(output_path, "wb") as f:
                f.write(content)
        print("  Done.")
    except Exception as e:
        print(f"  Error downloading {output_path}: {e}")


def main():
    make_dirs()

    # --- CIE open data (GET) ---
    cie_files = [
        ("CIE_xyz_1964_10deg.csv", "ciexyz64_1nm.csv"),
        ("CIE_cc_1931_2deg.csv", "ciexy31_1nm.csv"),
        ("CIE_cc_1964_10deg.csv", "ciexy64_1nm.csv"),
        ("CIE_cfb_stv_2deg.csv", "ciexyz2006_2deg_1nm.csv"),
        ("CIE_cfb_stv_10deg.csv", "ciexyz2006_10deg_1nm.csv"),
        ("CIE_sle_photopic.csv", "vl1924e_1nm.csv"),
        ("CIE_sle_scotopic.csv", "scvle_1nm.csv"),
        ("CIE_sle_10deg.csv", "vl10deg_1nm.csv"),
        ("CIE_cfb_sle_2deg.csv", "cfb_vl_2deg_1nm.csv"),
        ("CIE_cfb_sle_10deg.csv", "cfb_vl_10deg_1nm.csv"),
        ("CIE_smb_cc_2deg.csv", "smb_cc_2deg_1nm.csv"),
        ("CIE_sle_mesopic_m_0.8.csv", "vl_mesopic_m08_1nm.csv"),
        ("CIE_max_sle_mesopic.csv", "vl_mesopic_max_efficacy.csv"),
    ]
    # CIE 1931 XYZ — CVRL matches committed formatting; CIE open file is numerically
    # identical but uses different decimal representation.
    post_download(
        CVRL + "offercsvcmfs.php",
        {"whichfile": "ciexyz31_1.csv"},
        "data/raw/ciexyz31_1nm.csv",
    )

    for remote, local in cie_files:
        get_download(CIE + remote, f"data/raw/{local}")

    # Stockman & Sharpe LMS — CVRL 1 nm (CIE file is 5 nm only)
    for endpoint, local in [
        ("conerequest_ss2.php", "ss2deg_1nm.csv"),
        ("conerequest_ss10.php", "ss10deg_1nm.csv"),
    ]:
        post_download(
            CVRL + endpoint,
            {"Cone_units": "energy", "Cone_steps": "1", "Cone_format": "csv"},
            f"data/raw/{local}",
        )

    # Stockman & Sharpe LMS — CVRL 0.1 nm fine (supplementary high-resolution tables)
    for endpoint, local in [
        ("conerequest_ss2.php", "ss2deg_01nm.csv"),
        ("conerequest_ss10.php", "ss10deg_01nm.csv"),
    ]:
        post_download(
            CVRL + endpoint,
            {"Cone_units": "energy", "Cone_steps": "fine", "Cone_format": "csv"},
            f"data/raw/{local}",
        )

    # --- CVRL CMFs ---
    for whichfile, local in [
        ("ciexyzj.csv", "ciexyzj_5nm.csv"),
        ("ciexyzjv.csv", "ciexyzjv_5nm.csv"),
        ("sbrgb2.csv", "sbrgb2deg_5nm.csv"),
        ("sbrgb10w.csv", "sbrgb10deg_5nm.csv"),
    ]:
        post_download(CVRL + "offercsvcmfs.php", {"whichfile": whichfile}, f"data/raw/{local}")

    # --- CVRL CIE 2006 physiological chromaticity (1 nm) ---
    for endpoint, local in [
        ("xyzccrequest_2.php", "ciexy2006_2deg_1nm.csv"),
        ("xyzccrequest_10.php", "ciexy2006_10deg_1nm.csv"),
    ]:
        post_download(
            CVRL + endpoint,
            {"xyzcc_steps": "1", "xyzcc_format": "csv"},
            f"data/raw/{local}",
        )

    # CIE 2006 physiological XYZ_F and chromaticity — CVRL 0.1 nm fine
    for endpoint, local, params in [
        ("xyzcmfrequest_2.php", "ciexyz2006_2deg_01nm.csv", {"xyz_steps": "fine", "xyz_format": "csv"}),
        ("xyzcmfrequest_10.php", "ciexyz2006_10deg_01nm.csv", {"xyz_steps": "fine", "xyz_format": "csv"}),
        ("xyzccrequest_2.php", "ciexy2006_2deg_01nm.csv", {"xyzcc_steps": "fine", "xyzcc_format": "csv"}),
        ("xyzccrequest_10.php", "ciexy2006_10deg_01nm.csv", {"xyzcc_steps": "fine", "xyzcc_format": "csv"}),
    ]:
        post_download(CVRL + endpoint, params, f"data/raw/{local}")

    # Physiological luminous efficiency (cone-fundamental-based) — CVRL 0.1 nm fine
    for endpoint, local in [
        ("lumrequest_2.php", "cfb_vl_2deg_01nm.csv"),
        ("lumrequest_10.php", "cfb_vl_10deg_01nm.csv"),
    ]:
        post_download(
            CVRL + endpoint,
            {"Lum_units": "energy", "Lum_steps": "fine", "Lum_format": "csv"},
            f"data/raw/{local}",
        )

    # --- CVRL cone fundamentals (log energy unless noted) ---
    for whichfile, local in [
        ("sp.csv", "sp_loge.csv"),
        ("smj2.csv", "smj2_loge.csv"),
        ("smj2_10.csv", "smj2_10_loge.csv"),
        ("smj10.csv", "smj10_loge.csv"),
        ("vw.csv", "vw_loge.csv"),
        ("vew.csv", "vew_loge.csv"),
        ("dpse_1.csv", "dpse_1nm.csv"),
    ]:
        post_download(CVRL + "offercsvcones.php", {"whichfile": whichfile}, f"data/raw/{local}")

    # --- CVRL luminous efficiency ---
    for whichfile, local in [
        ("vlje.csv", "vlje_5nm.csv"),
        ("vme_1.csv", "vme_1nm.csv"),
    ]:
        post_download(CVRL + "offercsvlum.php", {"whichfile": whichfile}, f"data/raw/{local}")

    # --- CVRL prereceptoral / photopigment (1 nm) ---
    post_download(CVRL + "macrequest.php", {"mac_steps": "1", "mac_format": "csv"}, "data/raw/macular_pigment_1nm.csv")
    post_download(CVRL + "lensrequest.php", {"lens_steps": "1", "lens_format": "csv"}, "data/raw/lens_density_1nm.csv")
    post_download(CVRL + "pigrequest.php", {"pig_steps": "1", "pig_format": "csv"}, "data/raw/photopigment_absorbance_1nm.csv")

    # --- Individual Stiles & Burch observer spreadsheets ---
    for remote, local in [
        ("database/data/sb_individual/SB2_individual_CMF.xls", "sb_individual/SB2_individual_CMF.xls"),
        ("database/data/sb_individual/SB10_corrected_indiv_CMFs.xls", "sb_individual/SB10_corrected_indiv_CMFs.xls"),
    ]:
        get_download(CVRL + remote, f"data/raw/{local}")


if __name__ == "__main__":
    main()
