import React, { Component } from 'react';
import { Menu, Label, Icon } from 'semantic-ui-react';
import { DragSource } from 'react-dnd';

const sourceBehaviour = {
    canDrag(props) {
        return props.orientation !== 'one';
    },
    beginDrag(props) {
        return {
            name: props.name,
            value: props.value,
            src: props.src,
        };
    },
    endDrag(props, monitor) {
        let item = monitor.getItem();
        let dropResult = monitor.getDropResult();
        if (DEBUG) {
            console.log('endDrag', item, dropResult);
        }
        if (
            dropResult &&
            dropResult.dropped &&
            item.src &&
            dropResult.dropEffect === 'move'
        ) {
            props.handleRemove(item.src, item.name, item.value);
        }
    },
};

class Annotation extends Component {
    render() {
        const {
            src,
            name,
            value,
            isDropped,
            isDragging,
            connectDragSource,
            label,
            orientation,
        } = this.props;
        const opacity = isDragging ? 0.4 : 1;

        let icon;
        if (orientation !== 'one') {
            icon = (
                <Icon
                    name='delete'
                    onClick={() => {
                        this.props.handleRemove(src, name, value);
                    }}
                />
            );
        }

        if (label) {
            return connectDragSource(
                <span>
                    <Label>
                        {name} {value} {icon}
                    </Label>
                </span>
            );
        }

        return connectDragSource(
            <div>
                <Menu.Item
                    active={isDropped}
                    name={value}
                    onClick={() => {
                        this.props.onClick(name, value, isDropped);
                    }}
                    className='annotation'
                />
            </div>
        );
    }
}

export default DragSource(
    'Annotation',
    sourceBehaviour,
    (connect, monitor) => ({
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging(),
    })
)(Annotation);
