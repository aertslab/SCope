from setuptools import setup, find_namespace_packages
import os


def get_bindserver_files():
    paths = []
    for (path, directories, filenames) in os.walk("scopeserver/bindserver"):
        for filename in filenames:
            if not filename.endswith(".py"):
                paths.append((path, [os.path.join(path, filename)]))
        paths.append(("scopeserver/bindserver", ["scopeserver/bindserver/server.js"]))
    return paths


setup(
    name="scope-server",
    entry_points={"console_scripts": ["scope-server = scopeserver:run"]},
    data_files=[
        (
            "scopeserver/dataserver/data/gene_mappings",
            [
                "scopeserver/dataserver/data/gene_mappings/terminal_mappings.pickle",
                "scopeserver/dataserver/data/gene_mappings/hsap_to_dmel_mappings.pickle",
                "scopeserver/dataserver/data/gene_mappings/mmus_to_dmel_mappings.pickle",
            ],
        )
    ]
    + get_bindserver_files(),
    version="1.8.0",
    description="SCope Data Server: a server for the SCope Client",
    url="",
    author="Maxime De Waegeneer",
    author_email="mdewaegeneer@gmail.com",
    license="GPL-3.0",
    packages=find_namespace_packages(exclude=["node_modules"]),
    install_requires=[
        "grpcio>=1.26.0",
        "grpcio-tools>=1.26.0",
        "grpcio-testing>=1.26.0",
        "loompy>=3.0.1",
        "pandas>=1.0.0",
        "numpy>=1.18.1",
        "pyscenic>=0.9.14",
        "appdirs>=1.4.3",
        "pyarrow>=0.16.0",
    ],
    zip_safe=False,
)
