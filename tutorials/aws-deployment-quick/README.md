# Setup and Deploy SCope as Amazon instance from SCope Public AMI

## Clone SCope Public AMI

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

## Configure and Deploy SCope

1. Go to, 
```
cd SCope/
```

2. Edit apache/config.json file by updating the value of *publicHostAddress*
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

3. Deploy SCope
```
npm run scope-aws
# Restart Apache Web Server
sudo systemctl restart httpd
```

A SCope instance should be running at http://```[public-dns-ipv4]``` or https://```[public-dns-ipv4]``` if secure protocol was used.