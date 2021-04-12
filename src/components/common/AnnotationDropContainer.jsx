import React, { Component } from 'react';
import { DropTarget } from 'react-dnd';
import Annotation from '../common/Annotation';
import Viewer from '../common/Viewer';

const targetBehaviour = {
    drop(props, monitor, component) {
        let item = monitor.getItem();
        let dropped = props.onDrop(
            item,
            props.viewerName,
            props.orientation,
            props.position
        );
        return { dropped: dropped };
    },
};

class AnnotationDropContainer extends Component {
    render() {
        const {
            isOver,
            canDrop,
            connectDropTarget,
            height,
            activeAnnotations,
            viewerName,
            orientation,
        } = this.props;
        const isActive = isOver && canDrop;

        let container = () => {
            if (activeAnnotations && Object.keys(activeAnnotations).length) {
                return Object.keys(activeAnnotations).map((name, i) => {
                    return activeAnnotations[name].map((value, j) => {
                        return (
                            <Annotation
                                name={name}
                                value={value}
                                key={j}
                                label
                                src={viewerName}
                                orientation={orientation}
                                handleRemove={this.handleRemove.bind(this)}
                            />
                        );
                    });
                });
            } else if (
                orientation === 'horizontal' ||
                orientation === 'vertical'
            ) {
                return (
                    <div
                        className='dropRow dropContainer'
                        style={{
                            width:
                                orientation === 'vertical'
                                    ? height + 'px'
                                    : 'auto',
                        }}>
                        <b>
                            Drag and drop here the annotations to
                            cross-reference.
                        </b>
                    </div>
                );
            } else {
                return <div className='dropContainer'></div>;
            }
        };

        return connectDropTarget(
            <div className={'dropZone noStretch ' + orientation}>
                {container()}
            </div>
        );
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        this.forceUpdate();
    }

    handleRemove(viewerName, name, value) {
        this.props.onRemove(
            viewerName,
            name,
            value,
            this.props.orientation,
            this.props.position
        );
    }
}

export default DropTarget(
    'Annotation',
    targetBehaviour,
    (connect, monitor) => ({
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
    })
)(AnnotationDropContainer);
