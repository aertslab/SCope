import _ from "lodash";
import { BackendAPI } from '../common/API'
import React, {Component} from "react";
import {
  Button,
  Header,
  Icon,
  Input,
  Popup,
  Modal,
  Divider,
  Form,
  TextArea,
  Card,
  CardContent
} from "semantic-ui-react";
import { instanceOf } from 'prop-types';
import CollabAnnoGeneSearch from  './CollabAnnoGeneSearch'
import OLSAutocomplete from  './OLSAutocomplete'
import { withCookies, Cookies } from 'react-cookie';

class CollaborativeAnnotation extends Component {

    static propTypes = {
		cookies: instanceOf(Cookies).isRequired
	}
    
    constructor() {
        super();
        this.state = {
            value: [],
            annoData: {}
        }
    }

    handleChange = (e, { name, value }) => {
        let annoData = this.state.annoData
        annoData[name] = value
        this.setState({ "annoData": annoData })
    }

    handleOLSResultSelect = (e, result) => {
        let annoData = this.state.annoData
        annoData['ols_data'] = result
        this.setState({ "annoData": annoData })

    }
    
    sendData = () => {
        BackendAPI.setColabAnnotationData(this.props.feature, this.state.selected, this.state.annoData, {'orcid_name': this.state.orcid_name, 'orcid_id': this.state.orcid_id, 'orcid_uuid': this.state.orcid_uuid})
    }

    render() {

        const {annoData, selected, orcid_name, orcid_id, orcid_uuid} = this.state;

        var cardStyle = {
            display: "block",
            width: "100vw",
            transitionDuration: "0.3s"
            };

        let olsWidget = () => {
            return (
                <OLSAutocomplete handleResultSelect={this.handleOLSResultSelect}/>
            )
        }

        let annotationModal = (orcid_id, orcid_name) => {
            return (
            <Modal 
                as={Form} 
                className="collab-anno" 
                closeOnEscape={false} 
                closeIcon 
                trigger={<Button>Add Annotation</Button>}
                onSubmit={this.sendData}>
                <Modal.Header>Add Annotation</Modal.Header>
                <Modal.Content>
                <Modal.Description>
                    <Card style={cardStyle}>
                        <CardContent>
                        <Form.Field>
                            <label>ID</label>
                            Cluster ID (read-only)
                            <input value={this.props.feature.feature} disabled />
                        </Form.Field>
                        <Form.Field>
                            <label>Curator</label>
                            <input disabled value={orcid_id + " (" +  orcid_name + ")"}/>
                        </Form.Field>
                        </CardContent>
                    </Card>
                    <Divider horizontal>
                        <Header as="h4">Ontology Annotation (Required) </Header>
                    </Divider>
                    <Card style={cardStyle}>
                        <CardContent>
                        <Form.Field> 
                            <label>Ontology Term (Powered by <a href="https://www.ebi.ac.uk/ols/index" target="_blank">EBI OLS</a>)</label>
                            {olsWidget()} 
                        </Form.Field>
                        </CardContent>
                    </Card>
                    <Divider horizontal>
                        <Header as="h4">Evidence (Optional)</Header>
                    </Divider>
                    <Card style={cardStyle}>
                        <CardContent>
                        <Form.Field>
                            {/* https://react.semantic-ui.com/modules/dropdown/#usage-remote */}
                            <label>Gene Symbols</label>
                            List of namespaced markers. Use identifiers.org standards for
                            resolving (But we need FlyBase !
                            https://registry.identifiers.org/prefixregistrationrequest).
                            {/* <input placeholder="Search for genes..." /> */}
                            <CollabAnnoGeneSearch selected={selected}></CollabAnnoGeneSearch>
                        </Form.Field>

                        <Form.Field>
                            <label>Publication (Optional)</label>
                            A publication with evidence that marker maps to cell type.
                            <Form.Input 
                            name="publication" value={this.state.publication} onChange={this.handleChange} placeholder="DOI of publication" />
                        </Form.Field>
                        <Form.Field>
                            <label>Comment (Optional)</label>
                            Used to document how the mapping was made and to detail any
                            uncertainty.
                            <Form.Input 
                            name="comment" value={this.state.comment} onChange={this.handleChange} placeholder="Free text..." />
                        </Form.Field>
                        </CardContent>
                    </Card>
                    {/* <Button>Add Markers Entry</Button> */}
                </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                <Button type="submit" primary>
                    Submit Annotation <Icon name="right chevron" />
                </Button>
                </Modal.Actions>
            </Modal>
            );
        }



        if (orcid_name && orcid_id && orcid_uuid && orcid_name != "" && orcid_id != "" && orcid_uuid != "") {
            return(annotationModal(orcid_id, orcid_name))
        } else {
            return(
                <Popup 
                position='bottom left'
                content={<b>You must be logged in with an ORCID ID to annotate datasets! (See header)</b>}
                trigger={<span><Button className="anno-button" disabled >Add Annotation</Button> </span>} hoverable fluid/>
            )
        }

    }

    componentWillMount() {
        let orcid_name = this.props.cookies.get("scope_orcid_name")
        let orcid_id = this.props.cookies.get("scope_orcid_id")
        let orcid_uuid = this.props.cookies.get("scope_orcid_uuid")

        this.setState({
            orcid_name: orcid_name,
            orcid_id: orcid_id,
            orcid_uuid: orcid_uuid,
        })
    }

};

export default withCookies(CollaborativeAnnotation);