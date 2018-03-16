import React, { Component } from 'react'
import { DropTarget } from 'react-dnd'
import Viewer from '../common/Viewer'
import Annotation from '../common/Annotation'
import { Label, Icon } from 'semantic-ui-react'

const targetBehaviour = {
    drop(props, monitor, component) {
        let item = monitor.getItem();
        let dropped = props.onDrop(item, props.name);
        return {dropped: dropped};
    },
}

class AnnotationContainer extends Component {
    constructor() {
        super();
        this.state = {
            annotations: []
        }
    }


    render() {
        const { isOver, canDrop, connectDropTarget, lastDroppedItem, activeAnnotations, height,  ...props } = this.props;
        const { annotations } = this.state;
        const isActive = isOver && canDrop;

        let backgroundColor = '#222';
        if (isActive) {
            backgroundColor = 'darkgreen';
        } else if (canDrop) {
            backgroundColor = 'darkkhaki';
        }

        let viewer = () => {
            if (activeAnnotations && Object.keys(activeAnnotations).length) {
                return (
                    <Viewer height={height} activeAnnotations={activeAnnotations}  {...props} />
                );
            } else {
                return (
                    <div className="dropContainer" style={{height: height + 'px'}}>
                        <p>
                            Drag and drop here the annotations you want to compare.<br />
                            You can drop more annotations to combine them together.
                        </p>
                    </div>
                )
            }
        }

        return connectDropTarget(
            <div>
                {viewer()}
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
}))(AnnotationContainer);