import React, { Component } from 'react';
import * as d3 from 'd3';

import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import Slider from 'rc-slider';

import { BackendAPI } from './API';


const Handle = Slider.Handle;

export default class Histogram extends Component {
    constructor(props) {
        super(props);
        this.state = {
            min: 0,
            max: 1,
            selected: props.feature ? props.feature.threshold : 0,
            matched: 0,
            total: 0,
            points: [],
        };
        this.w = 0;
        this.h = 0;
    }

    render() {
        const { field, feature } = this.props;
        const { min, max, selected, matched, total } = this.state;
        let enabled = feature && feature.feature.length;
        let handle = (props) => {
            // TODO: memory leak!?
            const { value, ...restProps } = props;
            return (
                // TODO: Received `false` for a non-boolean attribute `dragging`.
                <Handle value={value} {...restProps} />
            );
        };
        return (
            <div className='flexDisplay'>
                <svg
                    id={'thresholdSVG' + field}
                    style={{ width: '100%', height: '100%' }}></svg>
                <div className='auc'>
                    AUC threshold: <b>{selected.toFixed(4)}</b> (matched points:{' '}
                    {matched} / {total})
                </div>
                <Slider
                    disabled={!enabled}
                    value={selected}
                    min={min}
                    max={max}
                    step={0.0001}
                    handle={handle}
                    onChange={this.handleThresholdChange.bind(this)}
                    onAfterChange={() => this.handleUpdateTSNE()}
                />
            </div>
        );
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (
            JSON.stringify(this.props.feature) !=
                JSON.stringify(nextProps.feature) ||
            this.props.loomFile != nextProps.loomFile
        ) {
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
        value = value || 0;
        if (DEBUG) console.log('handleThresholdChange', value);
        let x = d3
            .scaleLinear()
            .domain([0, this.state.max])
            .rangeRound([0, this.state.width]);
        let svg = d3.select('#thresholdSVG' + this.props.field);
        svg.select('.threshold').attr('transform', function () {
            let cx = x(value);
            let cy = 0;
            return 'translate(' + cx + ',' + cy + ')';
        });
        let pts = this.state.points,
            n = this.state.total;
        let matched = 0;
        for (let i = 0; i < n; i++) {
            if (pts[i] >= value) matched++;
        }
        this.setState({ selected: value, matched: matched });
    }

    getCellAUCValues(feature, loomFile) {
        if (!feature || feature.feature.length == 0)
            return this.renderAUCGraph('', []);
        let query = {
            loomFilePath: loomFile,
            featureType: feature.featureType,
            feature: feature.feature,
        };
        BackendAPI.getConnection().then(
            (gbc) => {
                if (DEBUG) console.log('getCellAUCValuesByFeatures', query);
                gbc.services.scope.Main.getCellAUCValuesByFeatures(
                    query,
                    (err, response) => {
                        if (DEBUG)
                            console.log('getCellAUCValuesByFeatures', response);
                        if (response !== null) {
                            this.renderAUCGraph(feature, response.value);
                            this.handleThresholdChange(
                                this.props.feature.threshold
                            );
                        } else {
                            this.renderAUCGraph('', []);
                        }
                    }
                );
            },
            () => {
                BackendAPI.showError();
            }
        );
    }

    renderAUCGraph(feature, points) {
        console.log('renderAUCGraph', feature, points);
        let formatCount = d3.format(',.0f');
        let svg = d3.select('#thresholdSVG' + this.props.field);
        let bbox = svg.node().getBoundingClientRect();
        svg.selectAll('*').remove();
        let margin = { top: 10, right: 10, bottom: 30, left: 40 },
            width = bbox.width - margin.left - margin.right,
            height = bbox.height - margin.top - margin.bottom,
            max = d3.max(points),
            g = svg
                .append('g')
                .attr(
                    'transform',
                    'translate(' + margin.left + ',' + margin.top + ')'
                );

        this.setState({
            max: max,
            width: width,
            height: height,
            total: points.length,
            points: points,
            matched: points.length,
            selected: 0,
        });

        if (points.length == 0) {
            svg.append('text')
                .text('Select a regulon to see AUC histogram')
                .attr('text-anchor', 'middle')
                .attr(
                    'transform',
                    'translate(' + width / 2 + ',' + height / 2 + ')'
                );
            svg.append('svg:image')
                .attr('x', width * 0.1)
                .attr('y', height * 0.1)
                .attr('width', width * 0.8)
                .attr('height', height)
                .style('opacity', 0.3)
                .attr('xlink:href', 'src/images/histogram.png');
            return;
        }

        let x = d3.scaleLinear().domain([0, max]).rangeRound([0, width]);

        let bins = d3.histogram().domain(x.domain()).thresholds(x.ticks(100))(
            points
        );

        let y = d3
            .scaleLinear()
            .domain([
                0,
                d3.max(bins, function (d) {
                    return d.length;
                }),
            ])
            .range([height, 0]);

        let bar = g
            .selectAll('.bar')
            .data(bins)
            .enter()
            .append('g')
            .attr('class', 'bar')
            .attr('transform', function (d) {
                return 'translate(' + x(d.x0) + ',' + y(d.length) + ')';
            });

        bar.append('rect')
            .attr('x', 1)
            .attr('width', x(bins[0].x1) - x(bins[0].x0))
            .attr('height', function (d) {
                return height - y(d.length);
            })
            .attr('stroke', '#000')
            .attr('fill', this.props.color)
            .attr('opacity', 0.5);

        g.append('g')
            .attr('class', 'threshold')
            .append('line')
            .attr('stroke', this.props.color)
            .attr('stroke-width', '3px')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', 0)
            .attr('y2', height);

        g.append('g')
            .attr('class', 'axis axis--x')
            .attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x));

        g.append('g')
            .attr('class', 'axis axis--y')
            .attr('transform', 'translate(0, 0)')
            .call(d3.axisLeft(y));

        let component = this;
        if (feature.metadata && feature.metadata.autoThresholds) {
            let gt = g.append('g').attr('class', 'autoThresholds');
            feature.metadata.autoThresholds.map((t) => {
                let tx = x(t.threshold);
                gt.append('text')
                    .style('cursor', 'pointer')
                    .attr('text-anchor', 'middle')
                    .attr('transform', 'translate(' + tx + ',5)')
                    .text(t.name)
                    .on('click', function () {
                        component.handleThresholdChange(t.threshold);
                        component.handleUpdateTSNE();
                    })
                    .append('title')
                    .text(t.name);
                gt.append('line')
                    .attr('stroke', 'blue')
                    .attr('x1', tx)
                    .attr('x2', tx)
                    .attr('y1', 10)
                    .attr('y2', height);
            });
        }
    }
}
