import React, { Component } from 'react'
import { Menu, Label, Icon } from 'semantic-ui-react'
import { DragSource } from 'react-dnd'

const sourceBehaviour = {
    beginDrag(props) {
        console.log('begin drag', props)
        return {
            name: props.name,
            value: props.value,
            src: props.src
        }
    },
    endDrag(props, monitor) {
        let item = monitor.getItem();
        let dropResult = monitor.getDropResult();
        if (DEBUG) console.log('endDrag', item, dropResult);
        if (dropResult.dropped && item.src && (dropResult.dropEffect == 'move')) props.handleRemove(item.src, item.name, item.value);        
    }
}

class Annotation extends Component {
    render() {
        const { src, name, value, isDropped, isDragging, connectDragSource, label } = this.props
        const opacity = isDragging ? 0.4 : 1

        if (label) return connectDragSource(
            <span>
                <Label>
                    {name} {value}
                    <Icon name='delete' onClick={() => {
                        console.log('aaaaa');
                        this.props.handleRemove(src, name, value);
                    }} />                                
                </Label>
            </span>,
        )

        return connectDragSource(
            <div>
                <Menu.Item active={isDropped} name={value} onClick={this.handleClick.bind(this)} ></Menu.Item>
            </div>,
        )
    }

    handleClick() {

    }
}

export default DragSource('Annotation', sourceBehaviour, (connect, monitor) => ({
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
}))(Annotation);