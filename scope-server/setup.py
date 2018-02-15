from setuptools import setup

setup(name='scope-server',
      entry_points={'console_scripts': [
                        'scope-server = scopeserver:run'
                        ]
                    },
      version='0.0.1',
      description='Server for the SCope software',
      url='',
      author='M.D.W',
      author_email='mdewaegeneer@gmail.com',
      license='Apache 2.0',
      packages=['scopeserver'],
      install_requires=[
          'grpcio',
          'loompy',
          'pandas'
      ],
      zip_safe=False)
