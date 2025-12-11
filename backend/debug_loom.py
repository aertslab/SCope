import loompy
import os
import numpy as np

def inspect_loom(path):
    print(f"Inspecting {path}")
    if not os.path.exists(path):
        print("Path does not exist")
        return

    try:
        with loompy.connect(path, mode='r', validate=False) as ds:
            print("Global Attributes:", ds.attrs.keys())
            print("Row Attributes (ra):", ds.ra.keys())
            print("Col Attributes (ca):", ds.ca.keys())
            
            if "RegulonsAUC" in ds.ca:
                print("\nRegulonsAUC found in ca")
                attr = ds.ca["RegulonsAUC"]
                print(f"Type: {type(attr)}")
                if hasattr(attr, 'dtype'):
                    print(f"Dtype: {attr.dtype}")
                    if attr.dtype.names:
                        print(f"Names: {attr.dtype.names[:10]}...")
            else:
                print("\nRegulonsAUC NOT found in ca")
                
            if "RegulonsAUC" in ds.ra:
                print("\nRegulonsAUC found in ra")
            
            # Check for other potential names
            for k in ds.ca.keys():
                if "Regulon" in k:
                    print(f"Found potential match in ca: {k}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    base_dir = "/app/uploads"
    for f in os.listdir(base_dir):
        if f.endswith(".loom"):
            inspect_loom(os.path.join(base_dir, f))
