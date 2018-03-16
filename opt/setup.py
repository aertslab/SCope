from setuptools import setup
from setuptools.command.develop import develop
from setuptools.command.install import install

setup(name='scope-server',
      entry_points={'console_scripts': [
                        'scope-server = scopeserver:run'
                        ]
                    },
      version='0.0.1',
      description='SCope Data Server: a server to load and serve the data to the SCope Client',
      url='',
      author='M.D.W',
      author_email='mdewaegeneer@gmail.com',
      license='Apache 2.0',
      packages=['scopeserver'],
      install_requires=[
          'grpcio>=1.7.0',
          'loompy>=2.0',
          'pandas',
          'numpy'
      ],
      zip_safe=False)
