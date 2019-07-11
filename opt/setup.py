from setuptools import setup

setup(name='scope-server',
      entry_points={'console_scripts': [
                        'scope-server = scopeserver:run'
                        ]
                    },
      data_files=[
          ('gene_mappings', ['data/gene_mappings/terminal_mappings.pickle', 
                             'data/gene_mappings/hsap_to_dmel_mappings.pickle',
                             'data/gene_mappings/mmus_to_dmel_mappings.pickle']),
      ],
      version='1.3.6',
      description='SCope Data Server: a server to load and serve the data to the SCope Client',
      url='',
      author='Maxime De Waegeneer',
      author_email='mdewaegeneer@gmail.com',
      license='GPL-3.0',
      packages=['scopeserver'],
      install_requires=[
          'grpcio>=1.7.0',
          'grpcio-tools>=1.7.0',
          'loompy==2.0.2',
          'pandas==0.23.4',
          'numpy',
          'pyscenic==0.9.5',
          'appdirs',
          'dask<=2.0.0',
          'distributed==1.21.6'
      ],
      zip_safe=False)
