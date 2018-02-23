import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import * as d3 from 'd3';
import React, { Component } from 'react'
import Slider from 'rc-slider';
import { BackendAPI } from './API'; 

const Handle = Slider.Handle;

export default class AUCThreshold extends Component {

	constructor(props) {
		super(props);
		this.state = {
			min: 0,
			max: 1,
			selected: props.value,
			width: 0,
			height: 0,
			matched: 0,
			total: 0,
			points: []
		}
	}

	render() {
		const { field, feature } = this.props;
		const { min, max, selected, matched, total } = this.state;
		let handle = (props) => {
			// TODO: memory leak!?
			const { value, ...restProps } = props;
			return (
				<Handle value={value} {...restProps} />
			);
		};
		return (
			<div>
				<svg id={"thresholdSVG" + field} style={{width: 100+'%'}} height="150" ></svg>
				<p>AUC threshold: <b>{selected.toFixed(4)}</b> (matched points: {matched} / {total})</p>
				<Slider disabled={feature.value == ''} value={selected} min={min} max={max} step={0.0001} handle={handle} onChange={this.handleThresholdChange.bind(this)}  onAfterChange={this.handleUpdateTSNE.bind(this)} />
			</div>
		);
	}

	componentWillReceiveProps(nextProps) {
		if ((this.props.feature != nextProps.feature) || (this.props.loomFile != nextProps.loomFile)) {
			this.getCellAUCValues(nextProps.feature, nextProps.loomFile);
		}
	}

	componentDidMount() {
		this.getCellAUCValues(this.props.feature, this.props.loomFile);
	}


	handleUpdateTSNE() {
		this.props.onThresholdChange(this.props.field, this.state.selected);
	}

	handleThresholdChange(value) {
		var x = d3.scaleLinear()
			.domain([0, this.state.max])
			.rangeRound([0, this.state.width]);
		var svg = d3.select("#thresholdSVG"+this.props.field);
		svg.select(".threshold")
			.attr("transform", function() {
				let cx = x(value);
				let cy = 0;
				return "translate("+cx+","+cy+")";
			});
		let pts = this.state.points, n = this.state.total;
		let matched = 0;
		for (let i=0; i < n; i++) {
			if (pts[i] >= value) matched++;
		}
		this.setState({selected: value, matched: matched});
	}

	getCellAUCValues(feature, loomFile) {
		let query = {
			loomFilePath: loomFile,
			featureType: feature.type,
			feature: feature.value
		};
		BackendAPI.getConnection().then((gbc) => {
			gbc.services.scope.Main.getCellAUCValuesByFeatures(query, (err, response) => {
				if(response !== null) {
					this.renderAUCGraph(feature, response.value);
					this.handleThresholdChange(this.props.value);
				} else {
					this.renderAUCGraph([])
				}
			});
		});
	}

	renderAUCGraph(feature, points) {
		var formatCount = d3.format(",.0f");
		var svg = d3.select("#thresholdSVG"+this.props.field);
		var width = svg.node().getBoundingClientRect().width
		svg.attr('width', width);
		svg.selectAll("*").remove();
		var margin = {top: 10, right: 10, bottom: 30, left: 40},
			width = +svg.attr("width") - margin.left - margin.right,
			height = +svg.attr("height") - margin.top - margin.bottom,
			max = d3.max(points),
			g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		this.setState({ max: max, width: width, height: height, total: points.length, points: points, matched: points.length, selected: 0 });

		var x = d3.scaleLinear()
			.domain([0, max])
			.rangeRound([0, width]);

		var bins = d3.histogram()
			.domain(x.domain())
			.thresholds(x.ticks(100))
			(points);

		var y = d3.scaleLinear()
			.domain([0, d3.max(bins, function(d) { return d.length; })])
			.range([height, 0]);

		var bar = g.selectAll(".bar")
		  .data(bins)
		  .enter()
			.append("g")
			.attr("class", "bar")
			.attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; });

		bar.append("rect")
			.attr("x", 1)
			.attr("width", x(bins[0].x1) - x(bins[0].x0))
			.attr("height", function(d) { return height - y(d.length); })
			.attr("stroke", "#000")
			.attr("fill", this.props.color)
			.attr("opacity", .5);

		g.append("g")
			.attr("class", "threshold")
			.append("line")
			.attr("stroke", this.props.color)
			.attr("stroke-width", "3px")
			.attr("x1", 0)
			.attr("x2", 0)
			.attr("y1", 0)
			.attr("y2", height);

		g.append("g")
			.attr("class", "axis axis--x")
			.attr("transform", "translate(0," + height + ")")
			.call(d3.axisBottom(x));    

		g.append("g")
			.attr("class", "axis axis--y")
			.attr("transform", "translate(0, 0)")
			.call(d3.axisLeft(y));    

		let metadata = BackendAPI.getActiveLoomMetadata();
		let component = this;
		if (metadata.fileMetaData.hasRegulonsAUC) {
			let gt = g.append("g")
				.attr("class", "autoThresholds");
			metadata.regulonMetaData.regulons.map((regulon) => {
				if (regulon.name == feature.value) {
					regulon.autoThresholds.map((t) => {
						let tx = x(t.threshold);
						gt.append("text")
							.style("cursor", "pointer")
							.attr("text-anchor", "middle")
							.attr("transform", "translate("+tx+",5)")
							.text(t.name)
							.on('click', function() {
								component.handleThresholdChange(t.threshold);
							})
							.append('title')
							.text(t.name);
						gt.append("line")
							.attr("stroke", "blue")
							.attr("x1", tx)
							.attr("x2", tx)
							.attr("y1", 10)
							.attr("y2", height);
					});
				}
			})
		}

	}

}
