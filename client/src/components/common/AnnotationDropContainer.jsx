import React, { Component } from 'react';
import { DropTarget } from 'react-dnd';
import Annotation from '../common/Annotation';

const targetBehaviour = {
    drop(props, monitor) {
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
            connectDropTarget,
            height,
            activeAnnotations,
            viewerName,
            orientation,
        } = this.props;
        let container = () => {
            if (activeAnnotations && Object.keys(activeAnnotations).length) {
                return Object.keys(activeAnnotations).map((name) => {
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

    UNSAFE_componentWillReceiveProps() {
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
