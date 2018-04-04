import { instanceOf } from 'prop-types';
import React, { Component } from 'react';
import { withRouter, Route, Link } from 'react-router-dom';
import { withCookies, Cookies } from 'react-cookie';
import ReactResizeDetector from 'react-resize-detector';
import ReactGA from 'react-ga';
import { Sidebar, Segment, Dimmer, Loader, Button } from 'semantic-ui-react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import AppContent from './AppContent';
import { BackendAPI } from './common/API';

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
			isSidebarVisible: true,
		}
		this.timeout = null;
		ReactGA.initialize('UA-61194136-10');
	}

	render() {
		const { loading, metadata } = this.state;
		return (
			<Route path="/:uuid/:loom?/:page?" render={({history}) =>
				<Segment className="parentView">
					<ReactResizeDetector handleHeight skipOnMount onResize={this.onResize.bind(this)} />
					<AppHeader 
						toggleSidebar={this.toggleSidebar.bind(this)} 
						metadata={metadata}
						timeout={this.timeout} 
					/>
					<Sidebar.Pushable>
						<AppSidebar visible={this.state.isSidebarVisible} onMetadataChange={metadata => {this.setState({metadata})}} />
						<Sidebar.Pusher>
							<AppContent />
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
				</Segment>
			} />
		);
	}

	componentWillMount() {
		this.parseURLParams(this.props);
		this.getUUID(this.props);
	}

	componentWillUnmount() {
		if (this.timer) clearInterval(this.timer);
	}

	componentWillReceiveProps(nextProps) {
		this.parseURLParams(nextProps);
		if (this.state.uuid != nextProps.match.params.uuid)
			this.getUUID(nextProps);
	}

	parseURLParams(props) {
		let loom = props.match.params.loom;
		let page = props.match.params.page;
		BackendAPI.setActiveLoom(loom ? loom : '');
		BackendAPI.setActivePage(page ? page : 'welcome');
		ReactGA.pageview('/' + loom + '/' + page);
	}

	getUUID(props) {
		const { cookies, match } = props;

		publicIp.v4().then(ip => {
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
				})
			}
		});
	}

	checkUUID(ip, uuid) {
		const { cookies, history, match } = this.props;
		if (!uuid) return;
		BackendAPI.getConnection().then((gbc) => {
			let query = {
				ip: ip,
				UUID: uuid
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
							this.forceUpdate();
						}
					}, timer);
				}
				history.push('/' + [uuid, match.params.loom ? match.params.loom : '*', match.params.page ? match.params.page : 'welcome' ].join('/'));
				ReactGA.set({ userId: uuid });
			});
		})
	}

	toggleSidebar() {
		this.setState({isSidebarVisible: !this.state.isSidebarVisible});
	}

	onResize() {
		this.forceUpdate();
	}
};

export default withRouter(withCookies(App));