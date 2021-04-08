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
from typing import Dict, Any, Union, Optional

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

    def __init__(self, config: Dict[str, Any]):
        self.run_event = threading.Event()
        self.run_event.set()
        self.config = config
        self.xs_thread: Optional[threading.Thread] = None
        self.gs_thread: Optional[threading.Thread] = None
        self.ps_thread: Optional[threading.Thread] = None

        if self.config["DEBUG"]:
            LOGGER.setLevel(logging.DEBUG)

    def start_bind_server(self) -> None:
        LOGGER.debug(f"Starting bind server on port {self.config['BIND_PORT']}")
        self.xs_thread = threading.Thread(
            target=xs.run, args=(self.run_event,), kwargs={"port": self.config["BIND_PORT"]}
        )
        self.xs_thread.start()

    def start_data_server(self) -> None:
        LOGGER.debug(f"Starting data server on port {self.config['DATA_PORT']}.")
        self.gs_thread = threading.Thread(
            target=gs.serve,
            args=(
                self.run_event,
                self.config,
            ),
        )
        LOGGER.debug(f"Starting upload server on port {self.config['UPLOAD_PORT']}")
        self.ps_thread = threading.Thread(
            target=ps.run, args=(self.run_event,), kwargs={"port": self.config["UPLOAD_PORT"]}
        )
        self.gs_thread.start()
        self.ps_thread.start()

    def start_scope_server(self) -> None:
        self.start_data_server()
        self.start_bind_server()

    def stop_servers(self) -> None:
        """ Stop all running threads. """
        LOGGER.info("Terminating servers...")
        self.run_event.clear()
        if self.gs_thread:
            self.gs_thread.join()

        try:
            urlopen("http://127.0.0.1:{0}/".format(self.config["UPLOAD_PORT"]))
        except http.client.RemoteDisconnected:
            pass

        if self.ps_thread:
            self.ps_thread.join()

        if self.xs_thread:
            self.xs_thread.join()
        LOGGER.info("Servers successfully terminated. Exiting.")

    def wait(self) -> None:
        try:
            while True:
                time.sleep(0.1)
        except KeyboardInterrupt:
            self.stop_servers()

    def run(self) -> None:
        # Unbuffer the standard output: important for process communication
        sys.stdout = su.Unbuffered(sys.stdout)  # type: ignore
        self.start_scope_server()
        self.wait()


def message_of_the_day(data_path: Union[str, Path]) -> None:
    """ Log a server startup message. """
    motd_path = data_path / Path("motd.txt")
    if motd_path.is_file():
        with open(motd_path) as motd:
            LOGGER.info(motd.read())
    else:
        LOGGER.info("Welcome to SCope.")


def generate_config(args: argparse.Namespace) -> configuration.Settings:
    """ Combine parsed command line arguments with configuration from a config file. """
    argscfg = {"DATA_PORT": args.g_port, "UPLOAD_PORT": args.p_port, "BIND_PORT": args.x_port}
    return configuration.Settings(*argscfg)


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

    message_of_the_day(config.DATA_PATH)
    LOGGER.info(f"Running SCope in {'debug' if config.DEBUG else 'production'} mode...")

    LOGGER.info(
        f"""This secret key will be used to hash annotation data: {config.DATAHASHSECRET}
        Losing this key will mean all annotations will display as unvalidated.
        """
    )

    # Start an instance of SCope Server
    scope_server = SCopeServer(config.dict())
    scope_server.run()


if __name__ == "__main__":
    run()
