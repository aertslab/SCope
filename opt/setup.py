from setuptools import setup

setup(name='scope-server',
      entry_points={'console_scripts': [
                        'scope-server = scopeserver.dataserver:dev'
                        ]
                    },
      version='1.3.2',
      description='SCope Data Server: a server to load and serve the data to the SCope Client',
      url='',
      author='Maxime De Waegeneer',
      author_email='mdewaegeneer@gmail.com',
      license='GPL-3.0',
      packages=['scopeserver'],
      install_requires=[
          'grpcio>=1.7.0',
          'grpcio-tools>=1.7.0',
          'loompy>=2.0.2',
          'pandas',
          'numpy',
          'pyscenic',
          'appdirs'
      ],
      zip_safe=False)
