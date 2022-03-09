"""
Main definition and entrypoint for the legacy SCope server
"""

import argparse
import threading
import time
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Union, Optional

from scopeserver.dataserver import GServer as gs
from scopeserver.dataserver.utils import sys_utils as su
import scopeserver.config as configuration

LOG_FMT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
logging.basicConfig(format=LOG_FMT, level=logging.INFO)
LOGGER = logging.getLogger(__name__)


class SCopeServer:
    """Legacy SCope server."""

    def __init__(self, config: Dict[str, Any]):
        self.run_event = threading.Event()
        self.run_event.set()
        self.config = config
        self.gs_thread: Optional[threading.Thread] = None

        if self.config["DEBUG"]:
            LOGGER.setLevel(logging.DEBUG)

    def start_scope_server(self) -> None:
        LOGGER.debug(f"Starting data server on port {self.config['RPC_PORT']}.")
        self.gs_thread = threading.Thread(
            target=gs.serve,
            args=(
                self.run_event,
                self.config,
            ),
        )
        self.gs_thread.start()

    def stop_servers(self) -> None:
        """Stop all running threads."""
        LOGGER.info("Terminating servers...")
        self.run_event.clear()
        if self.gs_thread:
            self.gs_thread.join()

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
    """Log a server startup message."""
    motd_path = data_path / Path("motd.txt")
    if motd_path.is_file():
        with open(motd_path, encoding="utf8") as motd:
            LOGGER.info(motd.read())
    else:
        LOGGER.info("Welcome to SCope.")


def generate_config(args: argparse.Namespace) -> configuration.Settings:
    """Combine parsed command line arguments with configuration from a config file."""
    argscfg = {"RPC_PORT": args.g_port, "UPLOAD_PORT": args.p_port, "BIND_PORT": args.x_port}
    return configuration.Settings(*argscfg)


def run() -> None:
    """Top-level entry point."""

    parser = argparse.ArgumentParser(description="Launch the scope server")
    parser.add_argument("--g_port", metavar="gPort", type=int, help="gPort", default=55853)
    parser.add_argument("--config_file", type=str, help="Path to config file", default=None)
    parser.add_argument("--debug", action="store_true", help="Show debug logging", default=False)
    args = parser.parse_args()

    config = generate_config(args)

    message_of_the_day(config.DATA_PATH)
    LOGGER.info(f"Running SCope in {'debug' if config.DEBUG else 'production'} mode...")

    LOGGER.info(
        f"""This secret key will be used to hash annotation data: {config.SECRET}
        Losing this key will mean all annotations will display as unvalidated.
        """
    )

    # Start an instance of SCope Server
    scope_server = SCopeServer(config.dict())
    scope_server.run()


if __name__ == "__main__":
    run()
