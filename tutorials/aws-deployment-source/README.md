# Setup and Deploy SCope as Amazon instance from Scratch

## Create AWS Amazon Linux 2 instance

1. Create an Amazon AWS account
2. Connect to you Amazon AWS account, go to Instances (left column) and click **Launch instance**
3. Select an **Amazon Linux 2** instance
<br>

![Step 1](/tutorials/aws-deployment-source/images/scope_aws_deploy_step1.png)
4. Select t2.micro instance type and click **Next: Configure Instance Details**
<br>

![Step 2](/tutorials/aws-deployment-source/images/scope_aws_deploy_step2.png)
<br>
/!\ This is an EBS storage type i.e.: The local instance store volumes that are available to the instance. **The data in an instance store is not permanent** - it persists only during the lifetime of the instance.
5. Configure instance details and/or click **Next: Add Storage**
<br>

![Step 3](/tutorials/aws-deployment-source/images/scope_aws_deploy_step3.png)
6. Type the amount of storage (GiB) you need for this instance and click **Next: Add Tags**
<br>

![Step 4](/tutorials/aws-deployment-source/images/scope_aws_deploy_step4.png)
7. Add SCope tag and/or any other tag and click **Next: Create Security Group**
<br>

![Step 5](/tutorials/aws-deployment-source/images/scope_aws_deploy_step5.png)
8. Create a security group to control the traffic (e.g.: HTTP inbound connections) of your instance and click **Review and Launch**
<br>

![Step 6](/tutorials/aws-deployment-source/images/scope_aws_deploy_step6.png)

Since, I already created a security group, I selected an existing one. For more details about authorizing only specific inbound HTTP (or other protocols) connections to your instance, please read: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html
9. Select **create a new key pair**. Type a name for your key pair. Download it and **store it in a secure and accessible location**. Click on **Launch instances**. You should now be able to see your newly created instance.

## Connect to AWS instance

Update the permissions of your key pair file:
```
chmod 400 [path-to-private-key]
```

```[path-to-private-key]``` should be replaced by the local path to the private key (.pem) downloaded in previous step **Create AWS instance**.

- Without configuring SSH config file:
    1. Open a new terminal and type to connect to your AWS instance:
```
ssh -i [path-to-private-key] ec2-user@[public-dns-ipv4]
```

```[public-dns-ipv4]``` should be replaced by the value shown in the Public DNS (IPv4) column of your Amazon WS instance.

Alternatively, you can also configure your SSH config file:

1. Update your ssh config file (```~/.ssh/config```) by adding the following lines:
```
Host aws-scope [public-dns-ipv4]
  User ec2-user
  Hostname [public-dns-ipv4]
  Port 22
  IdentityFile [path-to-private-key]
``` 

2. Open a new terminal and type to connect to your AWS instance:
```
ssh aws-scope
```

You can more detailed explanation at https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AccessingInstancesLinux.html.

## Install

First and foremost check if your are on a Amazon Linux 2 instance
```
cat /etc/system-release
# Should start with "Amazon Linux 2"
```

### Install Apache Web Server

1. Update softwares
```
sudo yum update -y
```

2. Install a LAMP Web Server on Amazon Linux 2

For all detailed information please read https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-lamp-amazon-linux-2.html

```
# Install HTTP Apache Server
sudo yum install -y httpd
```

3. Allow the ec2-user account to manipulate files in `/var/www/html` and `/etc/http.d/conf.d`:
```
sudo usermod -a -G apache ec2-user
exit
# Connect to your AWS instance
ssh aws-scope
# Change the group ownership of /var/www and its contents to the apache group
sudo chown -R ec2-user:apache /var/www
sudo chown -R ec2-user:apache /etc/httpd/conf.d
# Add group write permissions and to set the group ID on future subdirectories
sudo chmod 2775 /var/www && find /var/www -type d -exec sudo chmod 2775 {} \;
sudo chmod 2775 /etc/httpd/conf.d
find /var/www -type f -exec sudo chmod 0664 {} \;
```

4. Start the HTTP Apache Server
```
IS_ENABLED=$(sudo systemctl is-enabled httpd)
if [ "${IS_ENABLED}" = "enabled" ]; then
    echo "Apache Web Server is enabled"
else
    # If not enabled start
    echo "Apache Web Server is disabled. Starting Apache Web Server..."
    sudo systemctl start httpd && sudo systemctl enable httpd
fi
# Check HTTP Apache Web Server is running
sudo systemctl is-enabled httpd
# Start HTTP Apache Server at each system boot
sudo systemctl enable httpd
```

5. (Optional) To configure Apache Web Server on Amazon Linux 2 to Use SSL/TLS please read https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/SSL-on-an-instance.html.

### Install SCope

1. Install git
```
sudo yum install git
```

2. Install node.js
```
curl --silent --location https://rpm.nodesource.com/setup_10.x | sudo bash -
sudo yum -y install nodejs
```

3. Install development tools
```
sudo yum groupinstall "Development tools"
```

4. Install tmux
```
sudo yum install tmux
```

5. Install Miniconda
```
wget --content-disposition http://bit.ly/miniconda3
# Location: ~/.software/miniconda3
bash Miniconda3-latest-[...].sh
```

Don't forget to tell the installer to initialize Miniconda3 by running conda init. 
Then reload Bashrc using `bash` command.

6. Create conda environment and activate it
```
conda create -n scope python=3.6.2
source activate scope # or conda activate scope if higher version of conda
```

7. Install SCope
```
git clone https://github.com/aertslab/SCope.git
cd SCope
npm install
```

If the following error is raised when running `scope-server`:
```
pkg_resources.ContextualVersionConflict: (dask 1.0.0 (/home/ec2-user/.software/miniconda3/envs/scope/lib/python3.6/site-packages/dask-1.0.0-py3.6.egg), Requirement.parse('dask>=2'), {'distributed'})
```
please proceed by running the following lines:

```
pip uninstall distributed
pip uninstall pyscenic
pip install distributed==1.21.6
pip install pyscenic==0.9.5
```


8. Edit apache/config.json file by updating the value of *publicHostAddress*
```
{
    [...],
    "publicHostAddress": "[public-dns-ipv4]",
    [...]
}
```
With a secure protocol (e.g.: https):
```
{
    [...],
    "publicHostAddress": "[public-dns-ipv4]",
    "httpProtocol": "https",
    "httpPort": 443,
    "wsProtocol": "wss"
    [...]
}
```


9. Deploy SCope

If you are deploying SCope on a **t2.micro** (1 GB memory) AWS instance, please consider to run:
```
npm run scope-dev-aws
# Restart Apache Web Server
sudo systemctl restart httpd
```

Otherwise, please run:
```
npm run scope-aws
sudo systemctl restart httpd
```

A SCope instance should be running at http://```[public-dns-ipv4]``` or https://```[public-dns-ipv4]``` if secure protocol was used.
