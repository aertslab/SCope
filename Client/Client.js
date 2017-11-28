var PROTO_PATH = 'Proto/SCope.proto';

var grpc = require('grpc');
var scope_proto = grpc.load(PROTO_PATH).scope;

var params = { n1: 20, n2: 10 };

function main() {
  
  var client = new scope_proto.SCopeSearch('localhost:50050', grpc.credentials.createInsecure());

  client.divide(params, function (err, response) {
    console.log(response.f1);
  });

  client.multiply(params, function (err, response) {
    console.log(response.n1);
  });

  client.substract(params, function (err, response) {
    console.log(response.n1);
  });

  client.add(params, function (err, response) {
    console.log(response.n1);
  });

}

main();
