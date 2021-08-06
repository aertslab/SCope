var util = require('util')

var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({ port: process.argv[2] || 55852 });

console.log('Running GRPC Proxy on port ', wss.options.port);

var grpcBus = require('grpc-bus');
var protobuf = require("protobufjs");
var path = require("path")


gbBuilder = protobuf.loadProtoFile(path.join(__dirname,'grpc-bus.proto'));
gbTree = gbBuilder.build().grpcbus;

wss.on('connection', function connection(ws) {
  console.log('connected');

  ws.once('message', function incoming(data, flags) {
    var message = JSON.parse(data);
    var protoFileExt = message.filename.substr(message.filename.lastIndexOf('.') + 1);
    if (protoFileExt === "json") {
      protoDefs = protobuf.loadJson(message.contents, null, message.filename);
    } else {
      protoDefs = protobuf.loadProto(message.contents, null, message.filename);
    }
    var gbServer = new grpcBus.Server(protoDefs, function(message) {
      var pbMessage = new gbTree.GBServerMessage(message);
      if (ws.readyState === ws.OPEN) {
        ws.send(pbMessage.toBuffer());
      } else {
      }
    }, require('grpc'));

    ws.on('message', function incoming(data, flags) {

      var message = gbTree.GBClientMessage.decode(data);

      gbServer.handleMessage(message);
    });
  });
});
