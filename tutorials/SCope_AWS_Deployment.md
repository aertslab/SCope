# Create AWS instance

Create an Amazon Linux 2 instance
chmod 400 ~/.aws/aws_scope_admin2.pem

Add a security rule to allow inbound HTTP (port 80) connections to your instance: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-network-security.html#adding-security-group-rule, https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.ht

# Connect to AWS instance

# Install

## Install LAMP

Check if your are on a Amazon Linux 2 instance
```
cat /etc/system-release
# Should start with "Amazon Linux 2"
```

1. Update softwares
```sudo yum update -y```

2. Install a LAMP Web Server on Amazon Linux 2
For all detailed information please read https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-lamp-amazon-linux-2.html

```
sudo yum update -y
# Install LAMP
sudo amazon-linux-extras install lamp-mariadb10.2-php7.2 php7.2
# Install HTTP Apache Server
sudo yum install -y httpd
```

3. Allow the ec2-user account to manipulate files in this `/var/www/html`:
```
sudo usermod -a -G apache ec2-user
exit
# Connect to your AWS instance
ssh [...]
# Change the group ownership of /var/www and its contents to the apache group
sudo chown -R ec2-user:apache /var/www
# Add group write permissions and to set the group ID on future subdirectories
sudo chmod 2775 /var/www && find /var/www -type d -exec sudo chmod 2775 {} \;
find /var/www -type f -exec sudo chmod 0664 {} \;
```

4. Start the HTTP Apache Server
```
IS_ENABLED=$(sudo systemctl is-enabled httpd)
if [ "${IS_ENABLED}" = "enabled" ]; then
    echo "Apache Web Server is enabled"
else
    # If not enabled start
    sudo systemctl start httpd && sudo systemctl enable httpd
fi
# Check HTTP Apache Web Server is running
sudo systemctl is-enabled httpd
# Start HTTP Apache Server at each system boot
sudo systemctl enable httpd
```

5. (Optional) To configure Apache Web Server on Amazon Linux 2 to Use SSL/TLS please read https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/SSL-on-an-instance.html.

## Install SCope

1. Install git
```sudo yum install git```

2. Install node.js
```
curl --silent --location https://rpm.nodesource.com/setup_10.x | sudo bash -
sudo yum -y install nodejs
```

3. Install development tools
```
// https://stackoverflow.com/questions/19816275/no-acceptable-c-compiler-found-in-path-when-installing-python
sudo yum groupinstall "Development tools"
```

4. Install tmux
```sudo yum install tmux```

5. Install Miniconda
```
wget --content-disposition http://bit.ly/miniconda3
# Location: ~/.software/miniconda3
bash Miniconda3-latest-[...].sh
```

6. Create conda environment
```conda create -n scope python=3.6.2```

7. Install SCope
```
git clone https://github.com/aertslab/SCope.git
cd SCope
npm install
# /var/www/html/ is expected to be empty
cp -r . /var/www/html
```
