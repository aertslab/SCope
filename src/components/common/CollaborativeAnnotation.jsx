import _ from "lodash";
import { BackendAPI } from '../common/API'
import React, {Component} from "react";
import {
  Button,
  Header,
  Icon,
  Input,
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
            value: []
        }
    }

    render() {

        var cardStyle = {
            display: "block",
            width: "100vw",
            transitionDuration: "0.3s"
            };

        let olsWidget = () => {
            return (
                <OLSAutocomplete />
            )
        }

        let annotationModal = (orcid_id, orcid_name) => {
            return (
            <Modal className="collab-anno" closeOnEscape={false} trigger={<Button>Add Annotation</Button>}>
                <Modal.Header>Add Annotation</Modal.Header>
                <Modal.Content>
                <Modal.Description>
                    <Form>
                    <Card style={cardStyle}>
                        <CardContent>
                        <Form.Field>
                            <label>ID</label>
                            Cluster ID (read-only)
                            <input value="Unannotated" disabled />
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
                        {olsWidget()} 
                        </CardContent>
                    </Card>
                    <Divider horizontal>
                        <Header as="h4">Markers (Optional)</Header>
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
                            <CollabAnnoGeneSearch></CollabAnnoGeneSearch>
                        </Form.Field>

                        <Form.Field>
                            <label>Publication (Optional)</label>
                            A publication with evidence that marker maps to cell type.
                            <input placeholder="DOI of publication" />
                        </Form.Field>
                        <Form.Field>
                            <label>Comment (Optional)</label>
                            Used to document how the mapping was made and to detail any
                            uncertainty.
                            <TextArea placeholder="Free text..." />
                        </Form.Field>
                        </CardContent>
                    </Card>
                    <Button>Add Markers Entry</Button>
                    <Divider horizontal>
                        <Header as="h4">Publication(s) (Optional)</Header>
                    </Divider>
                    <Card style={cardStyle}>
                        <CardContent>
                        <Form.Field>
                            <label>Publication(s) (Optional)</label>
                            DOI of publication supporting mapping
                            <input placeholder="Unannotated" />
                        </Form.Field>
                        </CardContent>
                    </Card>
                    <Button>Add Publication Entry</Button>
                    {/* <Divider horizontal>
                        <Header as="h4">Supporting (Required)</Header>
                    </Divider>
                    <Form.Field>
                        <Input
                        icon="thumbs up outline"
                        iconPosition="left"
                        placeholder="Search users..."
                        />
                    </Form.Field>
                    <Divider />
                    <Form.Field>
                        <Input
                        icon="thumbs down outline"
                        iconPosition="left"
                        placeholder="Search users..."
                        />
                    </Form.Field> */}
                    </Form>
                </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                <Button primary>
                    Add <Icon name="right chevron" />
                </Button>
                </Modal.Actions>
            </Modal>
            );
        }

        let orcid_name = this.props.cookies.get("scope_orcid_name")
        let orcid_id = this.props.cookies.get("scope_orcid_id")
        if (orcid_name && orcid_id && orcid_name != "" && orcid_id != "") {
            return(annotationModal(orcid_id, orcid_name))
        }

    }

};

export default withCookies(CollaborativeAnnotation);