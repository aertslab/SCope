import subprocess
import os.path


def subprocess_cmd(command):
    process = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
    proc_stdout = process.communicate()[0].strip()


def run(run_event):
    while run_event.is_set():
        print('Starting XServer on port 8081...')
        cwd = os.path.dirname(__file__)
        subprocess_cmd('cd {0} && node server.js'.format(cwd))
