import React, { Component } from 'react';
import { DropTarget } from 'react-dnd';
import Viewer from '../common/Viewer';

const targetBehaviour = {
    drop(props, monitor, component) {
        let item = monitor.getItem();
        let dropped = props.onDrop(
            item,
            props.name,
            props.orientation,
            props.position
        );
        return { dropped: dropped };
    },
};

class ViewerDropContainer extends Component {
    render() {
        const {
            isOver,
            canDrop,
            orientation,
            loomFile,
            connectDropTarget,
            active,
            activeAnnotations,
            configuration,
            ...props
        } = this.props;
        console.log('loom', loomFile);
        let container = () => {
            if (
                loomFile &&
                ((activeAnnotations && Object.keys(activeAnnotations).length) ||
                    configuration == 'multi')
            ) {
                return (
                    <Viewer
                        loomFile={loomFile}
                        activeAnnotations={activeAnnotations}
                        {...this.props}
                    />
                );
            } else if (active) {
                return (
                    <div className='fullDropContainer dropContainer'>
                        <p>
                            <b>
                                Drag and drop here the annotations you want to
                                compare.
                            </b>
                            <br />
                            <br />
                            Drop more annotations to combine them together.
                            <br />
                            Move or copy annotations between the containers.
                            <br />
                            <br />
                            Change the number of the containers, their
                            configuration
                            <br />
                            and superposition properties in the upper left
                            corner of the page
                            <br />
                        </p>
                    </div>
                );
            } else if (orientation == 'one') {
                if (this.props.position != 0) return <div></div>;
                return (
                    <div className='emptyDropContainer dropContainer'>
                        <p>
                            <b>
                                Choose the annotation from the menu on the right
                            </b>
                            <br />
                            <br />
                            Select more annotations to view how the annotation
                            changes in the selected dataset.
                            <br />
                            <br />
                            Change the number of the containers, their
                            configuration
                            <br />
                            and superposition properties in the upper left
                            corner of the page
                            <br />
                        </p>
                    </div>
                );
            } else {
                return (
                    <div className='emptyDropContainer dropContainer'>
                        <p>
                            <b>Here you will see the annotated dataset</b>
                            <br />
                            <br />
                            Drop more annotations to combine them together.
                            <br />
                            Move or copy annotations between the containers.
                            <br />
                            <br />
                            Change the number of the containers, their
                            configuration
                            <br />
                            and superposition properties in the upper left
                            corner of the page
                            <br />
                        </p>
                    </div>
                );
            }
        };

        return connectDropTarget(
            <div className='flexDisplay stretched'>{container()}</div>
        );
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        this.forceUpdate();
    }

    handleRemove(name, value) {
        this.props.onRemove(this.props.name, name, value);
    }
}

export default DropTarget(
    (props) => {
        return props.active ? 'Annotation' : 'Nothing';
    },
    targetBehaviour,
    (connect, monitor) => ({
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
    })
)(ViewerDropContainer);
