import subprocess
import os.path
import sys


def subprocess_cmd(command, cwd):
    process = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True, cwd=cwd)
    proc_stdout = process.communicate()[0].strip()


def run(run_event, port=8081):
    while run_event.is_set():
        cwd = os.path.dirname(__file__)
        subprocess_cmd("node server.js {0}".format(port), cwd)
