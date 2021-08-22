const util = require('util')

var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({ port: process.argv[2] || 55852 });

console.log('Running GRPC Proxy on port ', wss.options.port);

const grpcBus = require('grpc-bus');
const protobuf = require("protobufjs");
const path = require("path")


const gbBuilder = protobuf.loadProtoFile(path.join(__dirname,'grpc-bus.proto'));
const gbTree = gbBuilder.build().grpcbus;

wss.on('connection', (ws) => {
  console.log('connected');

  ws.once('message', (data, flags) => {
    const message = JSON.parse(data);
    const protoDefs = protobuf.loadProto(message.contents, null, message.filename);

    const gbServer = new grpcBus.Server(protoDefs, (message) => {
      const pbMessage = new gbTree.GBServerMessage(message);
      if (ws.readyState === ws.OPEN) {
        ws.send(pbMessage.toBuffer());
      }
    }, require('grpc'));

    ws.on('message', (data, flags) => {
      gbServer.handleMessage(gbTree.GBClientMessage.decode(data));
    });
  });
});
