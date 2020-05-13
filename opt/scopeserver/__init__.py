"""
Main definition and entrypoint for the legacy SCope server
"""

import argparse
import threading
import time
from urllib.request import urlopen
import http
import sys
import logging
from pathlib import Path
from typing import Dict, Any, IO

from scopeserver.dataserver.modules.gserver import GServer as gs
from scopeserver.dataserver.modules.pserver import PServer as ps
from scopeserver.bindserver import XServer as xs
from scopeserver.dataserver.utils import sys_utils as su
import scopeserver.config as configuration

LOG_FMT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
logging.basicConfig(format=LOG_FMT, level=logging.INFO)
LOGGER = logging.getLogger(__name__)


class SCopeServer:
    """ Legacy SCope server. """

    def __init__(self, config):
        self.run_event = threading.Event()
        self.run_event.set()
        self.config = config
        self.xs_thread = None
        self.gs_thread = None
        self.ps_thread = None

        if self.config["debug"]:
            LOGGER.setLevel(logging.DEBUG)

    def start_bind_server(self) -> None:
        LOGGER.debug(f"Starting bind server on port {self.config['xPort']}")
        self.xs_thread = threading.Thread(target=xs.run, args=(self.run_event,), kwargs={"port": self.config["xPort"]})
        self.xs_thread.start()

    def start_data_server(self) -> None:
        LOGGER.debug(f"Starting data server on port {self.config['gPort']}. app_mode: {self.config['app_mode']}")
        self.gs_thread = threading.Thread(target=gs.serve, args=(self.run_event, self.config,))
        LOGGER.debug(f"Starting upload server on port {self.config['pPort']}")
        self.ps_thread = threading.Thread(target=ps.run, args=(self.run_event,), kwargs={"port": self.config["pPort"]})
        self.gs_thread.start()
        self.ps_thread.start()

    def start_scope_server(self) -> None:
        self.start_data_server()
        if not self.config["app_mode"]:
            self.start_bind_server()

    def wait(self) -> None:
        try:
            while True:
                time.sleep(0.1)
        except KeyboardInterrupt:
            LOGGER.info("Terminating servers...")
            self.run_event.clear()
            self.gs_thread.join()
            try:
                urlopen("http://127.0.0.1:{0}/".format(self.config["pPort"]))
            except http.client.RemoteDisconnected:
                pass
            self.ps_thread.join()

            if not self.config["app_mode"]:
                self.xs_thread.join()
            LOGGER.info("Servers successfully terminated. Exiting.")

    def run(self) -> None:
        # Unbuffer the standard output: important for process communication
        sys.stdout = su.Unbuffered(sys.stdout)  # type: ignore
        self.start_scope_server()
        self.wait()


def message_of_the_day(motd: IO) -> None:
    """ Log a server startup message. """
    LOGGER.info(motd.read())


def generate_config(args: argparse.Namespace) -> configuration.Config:
    """ Combine parsed command line arguments with configuration from a config file. """
    argscfg = {"gPort": args.g_port, "pPort": args.p_port, "xPort": args.x_port, "app_mode": args.app_mode}
    return {**configuration.from_file(args.config_file), **argscfg}


def run() -> None:
    """ Top-level entry point. """

    parser = argparse.ArgumentParser(description="Launch the scope server")
    parser.add_argument("--g_port", metavar="gPort", type=int, help="gPort", default=55853)
    parser.add_argument("--p_port", metavar="pPort", type=int, help="pPort", default=55851)
    parser.add_argument("--x_port", metavar="xPort", type=int, help="xPort", default=55852)
    parser.add_argument("--app_mode", action="store_true", help="Run in app mode (Fixed UUID)", default=False)
    parser.add_argument("--config_file", type=str, help="Path to config file", default=None)
    parser.add_argument("--debug", action="store_true", help="Show debug logging", default=False)
    args = parser.parse_args()

    config = generate_config(args)

    with open(str(config["data"]) / Path("motd.txt")) as motd:
        message_of_the_day(motd)
    LOGGER.info(f"Running SCope in {'debug' if config['debug'] else 'production'} mode...")

    LOGGER.info(
        f"""This secret key will be used to hash annotation data: {config['dataHashSecret']}
        Losing this key will mean all annotations will display as unvalidated.
        """
    )

    # Start an instance of SCope Server
    scope_server = SCopeServer(config)
    scope_server.run()


if __name__ == "__main__":
    run()
