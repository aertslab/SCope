import React, { Component } from 'react'
import { DropTarget } from 'react-dnd'
import Viewer from '../common/Viewer'

const targetBehaviour = {
	drop(props, monitor, component) {
		let item = monitor.getItem();
		let dropped = props.onDrop(item, props.name);
		return {dropped: dropped};
	},
}

class ViewerDropContainer extends Component {

	render() {
		const { isOver, canDrop, connectDropTarget, active, activeAnnotations, height, ...props } = this.props;

		let container = () => {
			if (!active || (activeAnnotations && Object.keys(activeAnnotations).length)) {
				return (
					<Viewer height={height} activeAnnotations={activeAnnotations}  {...props} />
				);
			} else {
				return (
					<div className="dropContainer" style={{height: height + 'px'}}>
						<p>
							<b>Drag and drop here the annotations you want to compare.</b><br /><br />
							Drop more annotations to combine them together.<br />
							Move or copy annotations between the containers.<br /><br />
							Change the number of the containers, their configuration<br />
							and superposition properties in the upper left corner of the page<br />
						</p>
					</div>
				)
			}
		}

		return connectDropTarget(
			<div>
				{container()}
			</div>,
		)
	}

	componentWillReceiveProps(nextProps) {
		this.forceUpdate();
	}

	handleRemove(name, value) {
		this.props.onRemove(this.props.name, name, value);
	}
}

export default DropTarget('Annotation', targetBehaviour, (connect, monitor) => ({
	connectDropTarget: connect.dropTarget(),
	isOver: monitor.isOver(),
	canDrop: monitor.canDrop(),
}))(ViewerDropContainer);