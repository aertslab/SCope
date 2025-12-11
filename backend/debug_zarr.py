import zarr
import os
import sys

def inspect_zarr(path):
    print(f"Inspecting {path}")
    if not os.path.exists(path):
        print("Path does not exist")
        return

    try:
        z = zarr.open(path, mode='r')
        print("Root keys:", list(z.keys()))
        
        if 'obsm' in z:
            print("\nobsm keys:", list(z['obsm'].keys()))
            obsm = z['obsm']
            for k in obsm.keys():
                obj = obsm[k]
                print(f"  {k}: {type(obj)}")
                if isinstance(obj, zarr.Array):
                    print(f"    dtype: {obj.dtype}")
                    if obj.dtype.names:
                        print(f"    names: {obj.dtype.names[:10]}...")
                elif isinstance(obj, zarr.Group):
                    print(f"    keys: {list(obj.keys())[:10]}...")
                    
        if 'var' in z:
             print("\nvar keys:", list(z['var'].keys()))
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Try to find the zarr file
    base_dir = "/app/uploads"
    for f in os.listdir(base_dir):
        if f.endswith(".zarr"):
            inspect_zarr(os.path.join(base_dir, f))
