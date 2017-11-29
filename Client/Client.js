var PROTO_PATH = 'Proto/SCope.proto';

var grpc = require('grpc');
var scope_proto = grpc.load(PROTO_PATH).scope;

var params = { filepath: "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/FB_20170919_LD.loom"
             , feature: "gene"
             , entry: "pros"
             , logtransform: true };

function main() {
  
  var client = new scope_proto.SCopeSearch('localhost:50050', grpc.credentials.createInsecure());

  client.query(params, function (err, response) {
    console.log(response.v);
  });

}

main();
