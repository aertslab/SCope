import React, { Component } from 'react';
// import proto from './../proto/SCope.proto';
import { Button } from 'semantic-ui-react'
// import scope from '../../src/static/SCope-wp-bundle.js'; 
// var grpc = require('grpc');
// var protobuf = require("protobufjs/minimal");
// require('script-loader!../../src/static/SCope-bundle.exec.js');
// import * as bundle from '../../src/static/SCope-bundle.js';
// var zerorpc = require("zerorpc");
// var client = new zerorpc.Client();
// import { SCope } from "../../src/proto/SCope_pb_service";
// import { CellColorByFeaturesRequest, FeatureRequest } from "../../src/proto/SCope_pb";

// import { grpc, Code, Metadata } from "grpc-web-client";

// https://github.com/styled-components/styled-components

export default class Home extends Component {

    constructor(props) {
        super(props);
        let GBC = require("grpc-bus-websocket-client");
        let params = {
            lfp: "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/FB_20170919_LD.loom"
            , f: ["gene", "gene", "gene"]
            , e: ["Gad1", "VGlut", "VAChT"]
            , lte: true
        };
        new GBC("ws://localhost:8081/", 'src/proto/SCope.proto', { scope: { SCope: 'localhost:50052' } })
            .connect()
            .then(function (gbc) {
                gbc.services.scope.SCope.getCellColorByFeatures(params, function (err, res) {
                    console.log(res.v[0]);
                });
            });
        // console.log(SCope)
        // console.log(CellColorByFeaturesRequest)
        // const cellColorByFeaturesRequest = new CellColorByFeaturesRequest();
        // cellColorByFeaturesRequest.setLfp("/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/FB_20170919_LD.loom");
        // cellColorByFeaturesRequest.setFList(["gene", "gene", "gene"])
        // cellColorByFeaturesRequest.setEList(["Gad1", "VGlut", "VAChT"])
        // cellColorByFeaturesRequest.setLte(true)
        // // console.log(cellColorByFeaturesRequest)
        // grpc.unary(SCope.getCCByF, {
        //     debug: true,// optional - enable to output events to console.log
        //     request: cCByFRequest,
        //     host: 'http://localhost:8081',
        //     onEnd: res => {
        //         console.log(res)
        //         // const { status, statusMessage, headers, message, trailers } = res;
        //         // console.log("Status:"+statusMessage)
        //         // if (status === Code.OK && message) {
        //         //     console.log("all ok. got book: ", message.toObject());
        //         // }
        //     }
        // });
        // client.connect("tcp://127.0.0.1:4242");
        // //calls the method on the python object
        // client.invoke("getCellColorByFeatures", "/home/luna.kuleuven.be/u0113561/Desktop/FlyBrainProject/FB_20170919_LD.loom"
        // , "Gad1", "VGlut","VAChT", true, function(error, reply, streaming) {
        //     if(error){
        //         console.log("ERROR: ", error);
        //     } else {
        //         console.log(reply);
        //     }
        // });
        // const SCope = protobuf
        // const caller = require('grpc-caller')
        // const PROTO_PATH = path.resolve(__dirname, '../proto/SCope.proto')
        // console.log(proto);
        // let PROTO_PATH = '../proto/SCope.proto';
        // var grpc = require('grpc');
        // let scope_proto = grpc.load(PROTO_PATH).scope;
        // this.scope = new scope_proto.SCope('localhost:50050', grpc.credentials.createInsecure());
    }

    render() {

        return (
            <div>
                <Button>Hellow Wooorld!!</Button>
            </div>
        );
    }
}

