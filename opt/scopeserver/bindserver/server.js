let WebSocketServer = require('ws').Server;
let wss = new WebSocketServer({ port: process.argv[2] });

let grpcBus = require('grpc-bus');
let protobuf = require('protobufjs');
let path = require('path');

gbBuilder = protobuf.loadProtoFile(path.join(__dirname, 'grpc-bus.proto'));
gbTree = gbBuilder.build().grpcbus;

wss.on('connection', function connection(ws) {
    console.log('connected');

    ws.once('message', function incoming(data, _) {
        let message = JSON.parse(data);
        let protoFileExt = message.filename.substr(
            message.filename.lastIndexOf('.') + 1
        );
        if (protoFileExt === 'json') {
            protoDefs = protobuf.loadJson(
                message.contents,
                null,
                message.filename
            );
        } else {
            protoDefs = protobuf.loadProto(
                message.contents,
                null,
                message.filename
            );
        }
        let gbServer = new grpcBus.Server(
            protoDefs,
            function (message) {
                let pbMessage = new gbTree.GBServerMessage(message);
                if (ws.readyState === ws.OPEN) {
                    ws.send(pbMessage.toBuffer());
                }
            },
            require('grpc')
        );

        ws.on('message', function incoming(data, _) {
            let message = gbTree.GBClientMessage.decode(data);

            gbServer.handleMessage(message);
        });
    });
});
