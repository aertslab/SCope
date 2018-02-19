from pynpm import NPMPackage
from setuptools import setup
from setuptools.command.develop import develop
from setuptools.command.install import install

class DevelopCommand(develop):
    """Post-installation for development mode."""
    def run(self):
        print("Installing XServer...")
        pkg = NPMPackage('scopeserver/modules/xserver/package.json')
        pkg.install()
        develop.run(self)

class InstallCommand(install):
    """Post-installation for installation mode."""
    def run(self):
        # PUT YOUR POST-INSTALL SCRIPT HERE or CALL A FUNCTION
        install.run(self)

setup(name='scope-server',
      entry_points={'console_scripts': [
                        'scope-server = scopeserver:run'
                        ]
                    },
      version='0.0.1',
      description='SCope Data Server: loading and serving the data to SCope Client',
      url='',
      author='M.D.W',
      author_email='mdewaegeneer@gmail.com',
      license='Apache 2.0',
      packages=['scopeserver'],
      install_requires=[
          'grpcio>=1.7.0',
          'loompy>=2.0',
          'pandas'
      ],
      cmdclass={
        'develop': DevelopCommand,
        'install': InstallCommand
      },
      zip_safe=False)
