#!/usr/bin/env python3
import os
import hashlib

def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def process_file(src, dest, headers):
    print(f"Processing {src} -> {dest} ...")
    if not os.path.exists(src):
        print(f"  Error: {src} does not exist.")
        return
        
    with open(src, "r") as f:
        lines = f.readlines()
        
    out_lines = [",".join(headers) + "\n"]
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Skip header if it already exists (e.g. for Stiles & Burch files)
        if line.lower().startswith("wavelength") or line.lower().startswith("wavenumber"):
            continue
        parts = [p.strip() for p in line.split(",") if p.strip()]
        
        # Pad with 0.0 if columns are omitted at the end of the line (e.g. S-cone at long wavelengths)
        if len(parts) > 0 and len(parts) < len(headers):
            while len(parts) < len(headers):
                parts.append("0.0")
                
        if len(parts) == len(headers):
            out_lines.append(",".join(parts) + "\n")
        elif len(parts) > len(headers):
            out_lines.append(",".join(parts[:len(headers)]) + "\n")
        else:
            print(f"  Warning: skipping line due to mismatch in column count: '{line}'")
            
    with open(dest, "w") as f:
        f.writelines(out_lines)
    print("  Done.")

def main():
    os.makedirs("data/processed", exist_ok=True)
    os.makedirs("data/reports", exist_ok=True)
    
    files_to_process = [
        ("ciexyz31_1nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("ciexyz64_1nm.csv", ["Wavelength", "X", "Y", "Z"]),
        ("lens_density_1nm.csv", ["Wavelength", "Density"]),
        ("macular_pigment_1nm.csv", ["Wavelength", "Density"]),
        ("photopigment_absorbance_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("sbrgb10deg_5nm.csv", ["Wavelength", "r", "g", "b"]),
        ("sbrgb2deg_5nm.csv", ["Wavelength", "r", "g", "b"]),
        ("scvle_1nm.csv", ["Wavelength", "V_prime"]),
        ("ss10deg_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("ss2deg_1nm.csv", ["Wavelength", "L", "M", "S"]),
        ("vl1924e_1nm.csv", ["Wavelength", "V"])
    ]
    
    checksums = []
    
    for filename, headers in files_to_process:
        src = os.path.join("data/raw", filename)
        dest = os.path.join("data/processed", filename)
        
        # Calculate raw file checksum
        if os.path.exists(src):
            sha = get_sha256(src)
            checksums.append(f"{filename}: {sha}")
            
        process_file(src, dest, headers)
        
    # Write checksums report
    report_path = "data/reports/checksums.txt"
    print(f"Writing checksums to {report_path} ...")
    with open(report_path, "w") as f:
        f.write("\n".join(checksums) + "\n")
    print("All tasks finished successfully.")

if __name__ == "__main__":
    main()
