import React, { Component } from 'react'
import { Menu } from 'semantic-ui-react'
import { DragSource } from 'react-dnd'

const propertyStyle = {
    border: '1px dashed gray',
    backgroundColor: 'white',
    padding: '0.5rem 1rem',
    marginRight: '1.5rem',
    marginBottom: '1.5rem',
    cursor: 'move',
    float: 'left',
}

const sourceBehaviour = {
    beginDrag(props) {
        return {
            name: props.name,
            value: props.value
        }
    },
}

class Annotation extends Component {
    render() {
        const { name, value, isDropped, isDragging, connectDragSource } = this.props
        const opacity = isDragging ? 0.4 : 1

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