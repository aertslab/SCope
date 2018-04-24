import { instanceOf } from 'prop-types';
import React, { Component } from 'react';
import { withRouter, Route, Link } from 'react-router-dom';
import { withCookies, Cookies } from 'react-cookie';
import ReactResizeDetector from 'react-resize-detector';
import ReactGA from 'react-ga';
import { Sidebar, Header, Image, Segment, Dimmer, Loader, Button, Icon } from 'semantic-ui-react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import { BackendAPI } from './common/API';
import Welcome from './pages/Welcome';
import Dataset from './pages/Dataset';
import Gene from './pages/Gene';
import Geneset from './pages/Geneset';
import Regulon from './pages/Regulon';
import Compare from './pages/Compare';
import Tutorial from './pages/Tutorial';
import About from './pages/About';

const publicIp = require('public-ip');
const timer = 60 * 1000;
const cookieName = 'SCOPE_UUID';

class App extends Component {
	static propTypes = {
		cookies: instanceOf(Cookies).isRequired
	}

	constructor() {
		super();
		this.state = {
			metadata: null,
			loading: true,
			loaded: false,
			error: false,
			isSidebarVisible: true,
		}
		this.timeout = null;
		ReactGA.initialize('UA-61194136-10');
	}

	render() {
		const { loading, metadata, error, loaded } = this.state;

		let errorDimmer = (
			<Dimmer active={error} >
				<Icon name='warning circle' color='red' size='huge' /><br /><br />
				<Header as='h2' inverted>
				An error occured when connecting to SCope back-end.<br /><br />
				Please check your Internet connection.
				</Header>
			</Dimmer>
		);

		return (
			<Segment className="parentView">
				<Route exact path="/" render={() => 
					<Segment textAlign='center' className="parentView">
						<Segment vertical>
							<Header as='h1'>SCope</Header>
							{/*for Fly Cell Atlas
							<br /><br />
							<Image src='src/images/flycellatlas.png' size="small" centered />
							<br /><br />*/}
						</Segment>
						{errorDimmer}
					</Segment>
				} />
				<Route path="/:uuid/:loom?/:page?" render={({history}) =>
					<Segment className="parentView">
						<ReactResizeDetector handleHeight skipOnMount onResize={this.onResize.bind(this)} />
						<AppHeader 
							toggleSidebar={this.toggleSidebar.bind(this)} 
							metadata={metadata}
							loaded={loaded}
							timeout={this.timeout} 
						/>
						<Sidebar.Pushable>
							<AppSidebar visible={this.state.isSidebarVisible} onMetadataChange={this.onMetadataChange.bind(this)} />
							<Sidebar.Pusher>
								<Route path="/:uuid/:loom?/welcome"  component={Welcome}  />
								<Route path="/:uuid/:loom?/dataset"  component={Dataset}  />
								<Route path="/:uuid/:loom?/gene"     component={Gene}     />
								<Route path="/:uuid/:loom?/geneset"  component={Geneset}  />
								<Route path="/:uuid/:loom?/regulon"  component={Regulon}  />
								<Route path="/:uuid/:loom?/compare"  component={Compare}  />
								<Route path="/:uuid/:loom?/tutorial" component={Tutorial} />
								<Route path="/:uuid/:loom?/about"    component={About}    />
							</Sidebar.Pusher>
						</Sidebar.Pushable>
						<Dimmer active={loading} inverted>
							<Loader inverted>Your SCope session is starting</Loader>
						</Dimmer>
						<Dimmer active={!loading && this.timeout != null && this.timeout <= 0}>
							Your SCope session has ended<br /><br />
							<Link to='/'>
								<Button primary onClick={() => {history.replace('/')}}>RESTART</Button>
							</Link>
						</Dimmer>
						{errorDimmer}
					</Segment>
				} />
			</Segment>
		);
	}

	componentWillMount() {
		if (DEBUG) console.log('App componentWillMount', this.props);
		this.parseURLParams(this.props);
		this.getUUIDFromIP(this.props);
	}

	componentWillUnmount() {
		if (this.timer) clearInterval(this.timer);
	}

	componentWillReceiveProps(nextProps) {
		this.parseURLParams(nextProps);
		if (this.state.uuid != nextProps.match.params.uuid)
			this.getUUIDFromIP(nextProps);
	}

	parseURLParams(props) {
		let loom = props.match.params.loom;
		let page = props.match.params.page;
		BackendAPI.setActivePage(page ? page : 'welcome');
		BackendAPI.setActiveLoom(loom ? loom : '');
		ReactGA.pageview('/' + encodeURIComponent(loom) + '/' + encodeURIComponent(page));
	}

	getUUIDFromIP(props) {
		publicIp.v4().then(ip => {
			this.getUUID(props, ip)
		}, () => {
			this.getUUID(props);
		});
	}

	getUUID(props, ip) {
		const { cookies, match } = props;

		if (match.params.uuid) {
			if (DEBUG) console.log('Params UUID detected');
			this.checkUUID(ip, match.params.uuid);
		} else if (cookies.get(cookieName)) {
			if (DEBUG) console.log('Cookie UUID detected');
			this.checkUUID(ip, cookies.get(cookieName));
		} else {
			if (DEBUG) console.log('No UUID detected');
			BackendAPI.getConnection().then((gbc) => {
				let query = {
					ip: ip
				}
				if (DEBUG) console.log('getUUID', query);
				gbc.services.scope.Main.getUUID(query, (err, response) => {
					if (DEBUG) console.log('getUUID', response);
					if (response != null) 
						this.checkUUID(ip, response.UUID);
				})
			}, () => {
				this.setState({error: true});
			})
		}
	}

	checkUUID(ip, uuid) {
		const { cookies, history, match } = this.props;
		if (!uuid) return;
		BackendAPI.getConnection().then((gbc, ws) => {
			let query = {
				ip: ip,
				UUID: uuid
			}
			gbc.ws.onclose = (err) => {
				ReactGA.event({
					category: 'errors',
					action: 'socket closed',
				});
				this.setState({error: true});
			}
			if (DEBUG) console.log('getRemainingUUIDTime', query);
			gbc.services.scope.Main.getRemainingUUIDTime(query, (err, response) => {
				if (DEBUG) console.log('getRemainingUUIDTime', response);				
				this.timeout = response ? parseInt(response.timeRemaining * 1000) : 0;
				cookies.set(cookieName, uuid, { path: '/', maxAge: this.timeout });
				this.setState({loading: false, uuid: uuid});
				if (!this.timer) {
					this.timer = setInterval(() => {
						this.timeout -= timer;
						if (this.timeout < 0) {
							if (DEBUG) console.log('Session timed out');
							cookies.remove(cookieName);
							clearInterval(this.timer);
							this.timer = null;
							if (!BackendAPI.isConnected()) {
								this.setState({error: true});
							}
							this.forceUpdate();
						}
					}, timer);
				}
				ReactGA.set({ userId: uuid });
				history.replace('/' + [uuid, encodeURIComponent(match.params.loom ? match.params.loom : '*'), encodeURIComponent(match.params.page ? match.params.page : 'welcome') ].join('/'));
			});
		}, () => {
			this.setState({error: true});
		})
	}

	onMetadataChange(metadata) {
		this.setState({ metadata: metadata, loaded: true });
	}

	toggleSidebar() {
		let state = !this.state.isSidebarVisible;
		this.setState({isSidebarVisible: state});
		ReactGA.event({
			category: 'settings',
			action: 'toggle sidebar',
			label: state ? 'on' : 'off'
		});
	}

	onResize() {
		this.forceUpdate();
	}
};

export default withRouter(withCookies(App));