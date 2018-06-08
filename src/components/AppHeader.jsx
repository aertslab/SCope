import React, { Component } from 'react';
import { withRouter, Link } from 'react-router-dom';
import { Icon, Label, Button, Menu, Input, Popup } from 'semantic-ui-react';
import { BackendAPI } from './common/API';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';
import Bitly from 'bitlyapi';
const moment = require('moment');
const pako = require('pako');
let bitly = new Bitly(BITLY.token);

const timer = 60 * 1000;
const cookieName = 'SCOPE_UUID';


class AppHeader extends Component {
	static propTypes = {
		cookies: instanceOf(Cookies).isRequired
	}

	constructor(props) {
		super(props);
		this.state = {
			timeout: props.timeout,
			shortUrl: null,
			cookies: props.cookies
		}
	}

	render() {
		const { match, location } = this.props;
		const { timeout, shortUrl } = this.state;
		let metadata = BackendAPI.getLoomMetadata(decodeURIComponent(match.params.loom));
		let menu = this.menuList(metadata);

		return (
			<Menu secondary attached="top" className="vib" inverted>
				<Menu.Item>
					<Icon name="sidebar" onClick={this.toggleSidebar.bind(this)} className="pointer" title="Toggle sidebar" />
				</Menu.Item>

				{menu.map((item, i) => item.display &&
					<Menu.Item key={i}>
						<Link to={'/' + [match.params.uuid, match.params.loom, item.path].join('/')}>
							<Button basic active={match.params.page == item.path}>
								{item.icon &&
									<Icon name={item.icon} />
								}
								{item.title} &nbsp; {item.path == 'geneset' && <Label color='violet' size='mini'>beta</Label>}
							</Button>
						</Link>
					</Menu.Item>
				)}

				<Menu.Item>
					<Icon name="linkify" onClick={this.getPermalink.bind(this)} className="pointer" title="Get permalink" />
					{shortUrl &&
						<Label className="permalink">{shortUrl}</Label>
					}
				</Menu.Item>

				<Menu.Item className="sessionInfo">
					Your session will be deleted in {moment.duration(timeout).humanize()} &nbsp;
					<Icon name="info circle" inverted title="Our servers can only store that much data. Your files will be removed after the session times out." />
					<Button data-tooltip="Start with a new session ID. Your old ID will remain until its timeout expires, please store it if you would like to return. It cannot be recovered."
									data-position="bottom right"
									onClick={this.resetUUID.bind(this)}>
						Get new session

					</Button>


				</Menu.Item>
			</Menu>
		);
	}

	resetUUID() {
		const { history, cookies } = this.props;
		BackendAPI.getUUIDFromIP((uuid, timeRemaining) => {
			cookies.remove(cookieName);
			cookies.set(cookieName, uuid, { path: '/'});
			history.replace('/' + [uuid])
			BackendAPI.forceUpdate();

		})
	}

	componentWillMount() {
		this.timer = setInterval(() => {
			let timeout = this.state.timeout;
			timeout -= timer;
			this.setState({timeout});
			if (timeout <= 0) {
				clearInterval(this.timer);
				this.timer = null;
			}
		}, timer);
	}

	componentWillReceiveProps(nextProps) {
		if (DEBUG) console.log('componentWillReceiveProps', nextProps);
		const { timeout, metadata, match, history, loaded } = nextProps;
		this.setState({timeout: timeout});
		/*
		if (loaded) {
			let menu = this.menuList(metadata);
			menu.map((item) => {
				if ((item.path == match.params.page) && (!item.display))  {
					if (metadata) {
						history.replace('/'+ [match.params.uuid, match.params.loom, 'dataset' ].join('/'));
					} else {
						history.replace('/'+ [match.params.uuid, match.params.loom, 'welcome' ].join('/'));
					}
				}
			});
		}
		*/
	}

	componentWillUnmount() {
		if (this.timer)	clearInterval(this.timer);
	}

	toggleSidebar() {
		this.props.toggleSidebar();
		BackendAPI.setSidebarVisible(!BackendAPI.getSidebarVisible());
	}

	menuList(metadata) {
		return [
			{
				display: true,
				path: 'welcome',
				title: 'SCope',
				icon: 'home'
			},
			/*
			{
				display: metadata ? true : false,
				path: 'dataset',
				title: 'Dataset info',
				icon: false
			},
			*/
			{
				display: metadata ? true : false,
				path: 'gene',
				title: 'Gene',
				icon: false
			},
			{
				display: metadata ? true : false,
				path: 'geneset',
				title: 'Geneset',
				icon: false
			},
			{
				display: metadata && metadata.fileMetaData.hasRegulonsAUC ? true : false,
				path: 'regulon',
				title: 'Regulon',
				icon: false
			},
			{
				display: metadata ? true : false,
				path: 'compare',
				title: 'Compare',
				icon: false
			},
			{
				display: true,
				path: 'tutorial',
				title: 'Tutorial',
				icon: false
			},
			{
				display: true,
				path: 'about',
				title: 'About',
				icon: false
			},
		];
	}

	getPermalink() {
		const { match } = this.props;
		console.log(BackendAPI);
		let j = JSON.stringify(BackendAPI.getExportObject(match.params), BackendAPI.getExportKeys());
		let d = pako.deflate(j, { to: 'string' });
		let b = encodeURIComponent(window.btoa(d).replace(/\//g,'$'));
		bitly.shorten(BITLY.baseURL + "/#/permalink/" + b)
		.then((result) => {
			this.setState({shortUrl: result.data.url});
			this.forceUpdate();
		}).then((error) => {
			console.log(error);
		});
	}
}

export default withRouter(AppHeader);
