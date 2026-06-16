#!/usr/bin/env python3
"""Compare current data/raw CSVs against committed baseline (CVRL) and alternate host (CIE)."""
import math
import os
import subprocess
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
BASE_COMMIT = "836ed18"
CVRL = "http://www.cvrl.org/"

# (local_name, committed_in_git, cvrl_fetch, cie_fetch)
# cvrl_fetch / cie_fetch: None, or (url, post_dict) or (get_url, None)
COMPARE_SET = [
    (
        "ciexyz31_1nm.csv",
        True,
        ("offercsvcmfs.php", {"whichfile": "ciexyz31_1.csv"}),
        "https://files.cie.co.at/CIE_xyz_1931_2deg.csv",
    ),
    (
        "ciexyz64_1nm.csv",
        True,
        ("offercsvcmfs.php", {"whichfile": "ciexyz64_1.csv"}),
        "https://files.cie.co.at/CIE_xyz_1964_10deg.csv",
    ),
    (
        "ss2deg_1nm.csv",
        True,
        ("conerequest_ss2.php", {"Cone_units": "energy", "Cone_steps": "1", "Cone_format": "csv"}),
        "https://files.cie.co.at/CIE_lms_cf_2deg.csv",
    ),
    (
        "ss10deg_1nm.csv",
        True,
        ("conerequest_ss10.php", {"Cone_units": "energy", "Cone_steps": "1", "Cone_format": "csv"}),
        "https://files.cie.co.at/CIE_lms_cf_10deg.csv",
    ),
    (
        "vl1924e_1nm.csv",
        True,
        ("offercsvlum.php", {"whichfile": "vl1924e_1.csv"}),
        "https://files.cie.co.at/CIE_sle_photopic.csv",
    ),
    (
        "scvle_1nm.csv",
        True,
        ("offercsvlum.php", {"whichfile": "scvle_1.csv"}),
        "https://files.cie.co.at/CIE_sle_scotopic.csv",
    ),
    (
        "sbrgb2deg_5nm.csv",
        True,
        ("offercsvcmfs.php", {"whichfile": "sbrgb2.csv"}),
        None,
    ),
    (
        "sbrgb10deg_5nm.csv",
        True,
        ("offercsvcmfs.php", {"whichfile": "sbrgb10w.csv"}),
        None,
    ),
]


def git_show(commit: str, path: str) -> str | None:
    r = subprocess.run(
        ["git", "show", f"{commit}:{path}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        return None
    return r.stdout


def fetch_cvrl(endpoint: str, data: dict) -> str:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(CVRL + endpoint, data=body)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_get(url: str) -> str:
    with urllib.request.urlopen(url) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_csv(text: str) -> list[tuple[float, list[float]]]:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith("wavelength") or low.startswith("wavenumber"):
            continue
        parts = [p.strip() for p in line.split(",") if p.strip()]
        if not parts:
            continue
        try:
            wl = float(parts[0])
        except ValueError:
            continue
        vals = [float(p) for p in parts[1:]]
        rows.append((wl, vals))
    return rows


def summarize(rows: list[tuple[float, list[float]]]) -> dict:
    if not rows:
        return {"rows": 0, "wl_min": None, "wl_max": None, "cols": 0}
    wls = [r[0] for r in rows]
    return {
        "rows": len(rows),
        "wl_min": min(wls),
        "wl_max": max(wls),
        "cols": max(len(r[1]) for r in rows),
    }


def compare(a: list[tuple[float, list[float]]], b: list[tuple[float, list[float]]], label: str) -> dict:
    amap = {wl: vals for wl, vals in a}
    bmap = {wl: vals for wl, vals in b}
    common = sorted(set(amap) & set(bmap))
    only_a = sorted(set(amap) - set(bmap))
    only_b = sorted(set(bmap) - set(amap))

    max_abs = 0.0
    max_rel = 0.0
    max_pair = None
    mismatched_cols = 0
    compared = 0

    for wl in common:
        va, vb = amap[wl], bmap[wl]
        n = min(len(va), len(vb))
        if len(va) != len(vb):
            mismatched_cols += 1
        for i in range(n):
            da = va[i] - vb[i]
            ad = abs(da)
            denom = max(abs(va[i]), abs(vb[i]), 1e-30)
            rel = ad / denom
            compared += 1
            if ad > max_abs:
                max_abs = ad
                max_rel = rel
                max_pair = (wl, i, va[i], vb[i], da)

    return {
        "label": label,
        "common_rows": len(common),
        "only_a": len(only_a),
        "only_b": len(only_b),
        "only_a_range": (only_a[0], only_a[-1]) if only_a else None,
        "only_b_range": (only_b[0], only_b[-1]) if only_b else None,
        "compared_values": compared,
        "max_abs_diff": max_abs,
        "max_rel_diff": max_rel,
        "worst": max_pair,
        "identical": compared > 0 and max_abs == 0.0,
    }


def fmt_worst(w):
    if not w:
        return "—"
    wl, col, a, b, d = w
    return f"λ={wl:g} col={col} {a:.8g} vs {b:.8g} Δ={d:.8g}"


def main():
    print("Dataset source verification\n" + "=" * 72)

    for local, in_git, cvrl_spec, cie_url in COMPARE_SET:
        path = RAW / local
        current_text = path.read_text(encoding="utf-8", errors="replace")
        current = parse_csv(current_text)
        cur_sum = summarize(current)

        print(f"\n## {local}")
        print(f"   current: {cur_sum['rows']} rows, λ {cur_sum['wl_min']}–{cur_sum['wl_max']}, {cur_sum['cols']} value cols")

        # vs committed baseline
        if in_git:
            base_text = git_show(BASE_COMMIT, f"data/raw/{local}")
            if base_text:
                base = parse_csv(base_text)
                base_sum = summarize(base)
                c = compare(current, base, "current vs committed (CVRL/embedded)")
                print(f"   committed ({BASE_COMMIT}): {base_sum['rows']} rows, λ {base_sum['wl_min']}–{base_sum['wl_max']}")
                if c["identical"]:
                    print("   ✓ identical to committed baseline")
                else:
                    print(f"   ✗ differs: max |Δ|={c['max_abs_diff']:.6g}, max rel={c['max_rel_diff']:.6g}")
                    print(f"     common rows={c['common_rows']}, only current={c['only_a']}, only committed={c['only_b']}")
                    if c["only_a_range"]:
                        print(f"     extra in current: {c['only_a_range']}")
                    if c["only_b_range"]:
                        print(f"     extra in committed: {c['only_b_range']}")
                    print(f"     worst: {fmt_worst(c['worst'])}")

        # vs live CVRL
        if cvrl_spec:
            ep, params = cvrl_spec
            try:
                cvrl_text = fetch_cvrl(ep, params)
                cvrl = parse_csv(cvrl_text)
                cvrl_sum = summarize(cvrl)
                c = compare(current, cvrl, "current vs live CVRL")
                print(f"   live CVRL: {cvrl_sum['rows']} rows, λ {cvrl_sum['wl_min']}–{cvrl_sum['wl_max']}")
                if c["identical"]:
                    print("   ✓ identical to live CVRL")
                else:
                    print(f"   ✗ differs from live CVRL: max |Δ|={c['max_abs_diff']:.6g}")
                    print(f"     worst: {fmt_worst(c['worst'])}")
            except Exception as e:
                print(f"   ! CVRL fetch failed: {e}")

        # vs CIE
        if cie_url:
            try:
                cie_text = fetch_get(cie_url)
                cie = parse_csv(cie_text)
                cie_sum = summarize(cie)
                c = compare(current, cie, "current vs CIE open data")
                print(f"   CIE open: {cie_sum['rows']} rows, λ {cie_sum['wl_min']}–{cie_sum['wl_max']}")
                if c["identical"]:
                    print("   ✓ identical to CIE open data (current source)")
                else:
                    print(f"   ✗ differs from CIE: max |Δ|={c['max_abs_diff']:.6g}")

                # committed vs CIE if we have baseline
                if in_git and base_text:
                    c2 = compare(base, cie, "committed vs CIE")
                    if c2["identical"]:
                        print("   ✓ committed baseline identical to CIE")
                    else:
                        print(f"   committed vs CIE: max |Δ|={c2['max_abs_diff']:.6g}, worst: {fmt_worst(c2['worst'])}")
            except Exception as e:
                print(f"   ! CIE fetch failed: {e}")

    print("\n" + "=" * 72)
    print("Done.")


if __name__ == "__main__":
    main()
