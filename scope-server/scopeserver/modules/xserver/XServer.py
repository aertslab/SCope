import subprocess

def subprocess_cmd(command):
    process = subprocess.Popen(command,stdout=subprocess.PIPE, shell=True)
    proc_stdout = process.communicate()[0].strip()

def run():
    # Note that you have to specify path to script
    print('Starting XServer on port 8081...')
    subprocess_cmd('cd modules/xserver; node server.js')
