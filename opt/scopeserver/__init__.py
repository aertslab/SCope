from scopeserver.dataserver.modules.gserver import GServer as gs
from scopeserver.dataserver.modules.pserver import PServer as ps
from scopeserver.bindserver import XServer as xs
from scopeserver.dataserver.utils import sys_utils as su

import threading
import os
import time
from urllib.request import urlopen
import http
import argparse
import sys
import logging

logger = logging.getLogger(__name__)

ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)

logger.addHandler(ch)

logger.setLevel(logging.DEBUG)

parser = argparse.ArgumentParser(description='Launch the scope server')
parser.add_argument('-g_port', metavar='gPort', type=int, help='gPort', default=55853)
parser.add_argument('-p_port', metavar='pPort', type=int, help='pPort', default=55851)
parser.add_argument('-x_port', metavar='xPort', type=int, help='xPort', default=55852)
parser.add_argument('--config', type=str, help='Path to config file', default=None)
parser.add_argument('--app_mode', action='store_true', help='Run in app mode (Fixed UUID)', default=False)

args = parser.parse_args()

if args.config is not None:
    if not os.path.isfile(args.config):
        raise FileNotFoundError(f'The config file {args.config} does not exist!')


class SCopeServer():

    def __init__(self):
        self.run_event = threading.Event()
        self.run_event.set()
        self.g_port = args.g_port
        self.p_port = args.p_port
        self.x_port = args.x_port
        self.app_mode = args.app_mode
        self.config = args.config

    def start_bind_server(self):
        logger.debug('Starting bind server on port {0}'.format(self.x_port))
        self.xs_thread = threading.Thread(target=xs.run, args=(self.run_event,), kwargs={'port': self.x_port})
        self.xs_thread.start()

    def start_data_server(self):
        logger.debug('Starting data server on port {0}. app_mode: {1}'.format(self.g_port, self.app_mode))
        self.gs_thread = threading.Thread(target=gs.serve, args=(self.run_event,), kwargs={'port': self.g_port, 'app_mode': self.app_mode, 'config': self.config})
        logger.debug('Starting upload server on port {0}'.format(self.p_port))
        self.ps_thread = threading.Thread(target=ps.run, args=(self.run_event,), kwargs={'port': self.p_port})
        self.gs_thread.start()
        self.ps_thread.start()

    def start_scope_server(self):
        self.start_data_server()
        if not self.app_mode:
            self.start_bind_server()

    def wait(self):
        try:
            while True:
                time.sleep(0.1)
        except KeyboardInterrupt:
            logger.info('Terminating servers...')
            self.run_event.clear()
            self.gs_thread.join()
            try:
                urlopen('http://127.0.0.1:{0}/'.format(self.p_port))
            except http.client.RemoteDisconnected:
                pass
            self.ps_thread.join()

            if not self.app_mode:
                self.xs_thread.join()
            logger.info('Servers successfully terminated. Exiting.')

    def run(self):
        logger.info('''\n

  /$$$$$$   /$$$$$$                                       /$$$$$$
 /$$__  $$ /$$__  $$                                     /$$__  $$
| $$  \__/| $$  \__/  /$$$$$$   /$$$$$$   /$$$$$$       | $$  \__/  /$$$$$$   /$$$$$$  /$$    /$$ /$$$$$$   /$$$$$$
|  $$$$$$ | $$       /$$__  $$ /$$__  $$ /$$__  $$      |  $$$$$$  /$$__  $$ /$$__  $$|  $$  /$$//$$__  $$ /$$__  $$
 \____  $$| $$      | $$  \ $$| $$  \ $$| $$$$$$$$       \____  $$| $$$$$$$$| $$  \__/ \  $$/$$/| $$$$$$$$| $$  \__/
 /$$  \ $$| $$    $$| $$  | $$| $$  | $$| $$_____/       /$$  \ $$| $$_____/| $$        \  $$$/ | $$_____/| $$
|  $$$$$$/|  $$$$$$/|  $$$$$$/| $$$$$$$/|  $$$$$$$      |  $$$$$$/|  $$$$$$$| $$         \  $/  |  $$$$$$$| $$
 \______/  \______/  \______/ | $$____/  \_______/       \______/  \_______/|__/          \_/    \_______/|__/
                              | $$
                              | $$
                              |__/
        ''')
        logger.info("Running SCope Server in production mode...")
        self.start_scope_server()
        self.wait()


def run():

    # Unbuffer the standard output: important for process communication
    sys.stdout = su.Unbuffered(sys.stdout)
    # Start an instance of SCope Server
    scope_server = SCopeServer()
    scope_server.run()


if __name__ == '__main__':
    run()
