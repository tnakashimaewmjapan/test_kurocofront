Vue.createApp({
	data() {
		return {
			isLogin: false,
			lists: [],
			login: {
				mail: "",
				password: "",
				gtoken: "",
				atoken: "",
				member_id: "",
				firstname: "",
				lastname: "",
				message: ""
			},
			register: {
				firstname: "",
				lastname: "",
				password: ""
			},
			logs: ""
		}
	},
	methods: {
		//ユーザー登録
		//ユーザー登録はログイン前に必要なアクションのため、動的トークンが不要なAPIで実行する。
		register_member() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/4/register',
					{
						"name1": this.register.firstname,
						"name2": this.register.lastname,
						"email": this.register.mail,
						"login_pwd": this.register.password,
						"login_ok_flg": "1",
						"validate_only": false,
						"auto_login": 0
					}
				)
				.then(response => {
					this.login.mail = this.register.mail,
					this.login.password = this.register.password,
					this.logs = response;
					setTimeout(this.do_login(), 3000);
				})
				.catch(e => this.logs = e);
		},
		//ログイン→アクセストークンの発行
		do_login() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/login ',
					{
						"email": this.login.mail,
						"password": this.login.password,
						"login_save": 0,
					})
				.then(response => {
					this.logs = response;
					this.login.gtoken = response.data.grant_token;
					this.get_atoken();
				})
				.catch(e => this.logs = e);
		},
		//ログイン時に取得したgrantトークンからアクセストークンを取得
		//ログイン状態を保持するためにローカルストレージを利用
		get_atoken() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/token', {
					'grant_token': this.login.gtoken
				})
				.then(response => {
					this.login.atoken = response.data.access_token.value;
					localStorage.setItem("gtoken", this.login.gtoken);
					localStorage.setItem("atoken", this.login.atoken);
					this.isLogin = true;
					this.get_profile();
				})
				.catch(e => this.logs = e);
		},
		//プロフィールの取得。APIが実行できればログイン状態とみなす
		get_profile() {
			axios
				.get('https://test-ewm.g.kuroco.app/rcms-api/3/profile', {
					headers: {
						'x-rcms-api-access-token': this.login.atoken
					}
				})
				.then(response => {
					if(response.data.member_id) {
						this.login.firstname = response.data.name1;
						this.login.lastname = response.data.name2;
						this.login.member_id = response.data.member_id;
						this.isLogin = true;
						this.logs = response;
						this.get_lists();
					}
				})
				.catch(e => {
					this.login.message = "";
					this.isLogin = false;
				})
		},
		//一覧を取得
		get_lists() {
			axios
				.get('https://test-ewm.g.kuroco.app/rcms-api/3/lists', {
					headers: {
						'x-rcms-api-access-token': this.login.atoken
					}
				})
				.then(response => {
					this.lists = response.data;
					this.logs = response.data;
				})
				.catch(e => {
					this.logs = e;
				})
		},
		//メッセージを投稿。投稿後、自動で一覧を更新
		submit() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/submit ',
					{
						"subject": this.login.message,
						"regular_flg": 0,
						"topics_flg": 1,
						"open_flg": 1,
						"ymd": new Date().toLocaleDateString('sv-SE'),
						"post_time": new Date().toLocaleTimeString('it-IT'),
						"author_id": {
							"module_type": "member",
							"module_id": this.login.member_id
						},
						"author_name": this.login.firstname + this.login.lastname
					},
					{
						headers: {
							'x-rcms-api-access-token': this.login.atoken
						}
					})
				.then(response => {
					this.logs = response;
					this.login.message = "";
					this.get_lists();
				})
				.catch(e => {
					this.logs = e;
				})
		},
		//ログアウト→プロフィールの再取得（取得失敗することで非ログイン状態を検知）
		do_logout() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/loguot', {},
					{
						headers: {
							'x-rcms-api-access-token': this.login.atoken
						}
					})
				.then(response => {
				})
				.catch(e => this.logs = e);
			localStorage.removeItem("gtoken");
			localStorage.removeItem("atoken");
			this.get_profile();
		}
	},
	mounted() {
		if (localStorage.getItem("atoken")) {
			this.login.gtoken = localStorage.getItem("gtoken");
			this.login.atoken = localStorage.getItem("atoken");
			this.get_profile();
		}
	}
}).mount("#app"); // id="app" の要素にマウント