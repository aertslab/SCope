from setuptools import setup, find_namespace_packages
import os


def get_bindserver_files():
    paths = []
    for (path, directories, filenames) in os.walk('scopeserver/bindserver'):
        for filename in filenames:
            if not filename.endswith('.py'):
                paths.append((path, [os.path.join(path, filename)]))
        paths.append(('scopeserver/bindserver', ['scopeserver/bindserver/server.js']))
    return paths

setup(name='scope-server',
      entry_points={'console_scripts': ['scope-server = scopeserver:run']},
      data_files=[
          ('scopeserver/dataserver/data/gene_mappings', ['scopeserver/dataserver/data/gene_mappings/terminal_mappings.pickle',
                                                         'scopeserver/dataserver/data/gene_mappings/hsap_to_dmel_mappings.pickle',
                                                         'scopeserver/dataserver/data/gene_mappings/mmus_to_dmel_mappings.pickle'])
      ] + get_bindserver_files(),
      version='1.4.2',
      description='SCope Data Server: a server to load and serve the data to the SCope Client',
      url='',
      author='Maxime De Waegeneer',
      author_email='mdewaegeneer@gmail.com',
      license='GPL-3.0',
      packages=find_namespace_packages(exclude=['node_modules']),
      install_requires=[
          'grpcio>=1.7.0',
          'grpcio-tools>=1.7.0',
          'loompy>=2.0.17',
          'pandas==0.23.4',
          'numpy',
          'pyscenic==0.9.14',
          'appdirs',
          'dask==1.0.0',
          'distributed==1.21.6'
      ],
      zip_safe=False)
