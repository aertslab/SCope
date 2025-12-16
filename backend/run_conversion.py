import sys
import os
sys.path.append('/app')

from app.utils.loom_converter import convert_loom_to_zarr
import zarr
import shutil
import asyncio

input_file = "/app/uploads/Aerts_Fly_AdultBrain_Filtered_57k.loom"
output_file = "/app/uploads/Aerts_Fly_AdultBrain_Filtered_57k.zarr"

print(f"Converting {input_file} to {output_file}")

if os.path.exists(output_file):
    print("Removing existing Zarr file")
    shutil.rmtree(output_file)

try:
    print("Conversion starting...")
    asyncio.run(convert_loom_to_zarr(input_file, output_file))
    print("Conversion successful.")
    
    # Verify
    z = zarr.open(output_file, mode='r')
    if 'obsm' in z:
        print("obsm keys:", list(z['obsm'].keys()))
    else:
        print("No obsm found")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
