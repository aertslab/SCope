import React, { Component } from 'react'
import { DropTarget } from 'react-dnd'
import Viewer from '../common/Viewer'
import { Label, Icon } from 'semantic-ui-react'

const targetBehaviour = {
    drop(props, monitor) {
        props.onDrop(monitor.getItem(), props.name)
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

        let annotationTags = () => {
            if (activeAnnotations) {
                return Object.keys(activeAnnotations).map((name, i) => {
                    return activeAnnotations[name].map((value, j) => {
                        return (
                            <Label key={j}>
                                {name} {value}
                                <Icon name='delete' onClick={() => {
                                    this.handleRemove(name, value);
                                }} />                                
                            </Label>
                        );
                    });
                });
            } else {
                return (
                    <b>&nbsp;</b>
                );
            }
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
                {annotationTags()}
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