var util = require('util')

var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({ port: 8081 });

var grpcBus = require('grpc-bus');
var protobuf = require("protobufjs");

gbBuilder = protobuf.loadProtoFile('grpc-bus.proto');
gbTree = gbBuilder.build().grpcbus;

wss.on('connection', function connection(ws) {
  console.log('connected');

  ws.once('message', function incoming(data, flags) {
    var message = JSON.parse(data);
    console.log('connected with');
    console.dir(message, { depth: null });
    var protoFileExt = message.filename.substr(message.filename.lastIndexOf('.') + 1);
    if (protoFileExt === "json") {
      protoDefs = protobuf.loadJson(message.contents, null, message.filename);
    } else {
      protoDefs = protobuf.loadProto(message.contents, null, message.filename);
    }
    var gbServer = new grpcBus.Server(protoDefs, function(message) {
      console.log('sending (pre-stringify): %s')
      console.dir(message, { depth: null });
      console.log('sending (post-stringify): %s')
      console.dir(JSON.stringify(message));
      //ws.send(JSON.stringify(message));
      var pbMessage = new gbTree.GBServerMessage(message);
      console.log('sending (pbMessage message):', pbMessage);
      console.log('sending (raw message):', pbMessage.toBuffer());
      console.log('re-decoded message:', gbTree.GBServerMessage.decode(pbMessage.toBuffer()));
      if (ws.readyState === ws.OPEN) {
        ws.send(pbMessage.toBuffer());
      } else {
        console.log('WebSocket closed before message could be sent:', pbMessage);
      }
    }, require('grpc'));

    ws.on('message', function incoming(data, flags) {
      console.log('received (raw):');
      console.log(data);
      console.log('with flags:')
      console.dir(flags);
      //var message = JSON.parse(data);
      var message = gbTree.GBClientMessage.decode(data);
      console.log('received (parsed):');
      // We specify a constant depth here because the incoming
      // message may contain the Metadata object, which has
      // circular references and crashes console.dir if its
      // allowed to recurse to print. Depth of 3 was chosen
      // because it supplied enough detail when printing
      console.dir(message, { depth: 3 });
      gbServer.handleMessage(message);
    });
  });
});
