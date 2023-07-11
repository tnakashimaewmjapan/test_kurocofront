Vue.createApp({
	data() {
		return {
			isLogin: false,
			lists: [],
			register: {
				firstname: "",
				lastname: "",
				password: ""
			},
			login: {
				mail: "",
				password: "",
				gtoken: "",
				atoken: "",
				member_id: "",
				firstname: "",
				lastname: "",
			},
			submit_content: {
				message: "",
				submit_image: "",
				img_thumb_url: ""
			},
			contact_content: {
				form: "",
				mail: "",
				res: "",
				res_e: "",
				status: ""
			},
			logs: ""
		}
	},
	methods: {
		//ユーザー登録
		//ユーザー登録はログイン前に必要なアクションのため、動的トークンが不要なAPI(/rcms-api/4/~)で実行する。
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
					//新規登録後3秒後にログインを実行
					this.login.mail = this.register.mail,
					this.login.password = this.register.password,
					setTimeout(this.do_login(), 3000);
				})
				.catch(e => this.logs = e.response.data.errors);
		},

		//ログイン→grantトークン→アクセストークンの発行
		do_login() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/login ',
					{
						"email": this.login.mail,
						"password": this.login.password,
						"login_save": 0,
					})
				.then(response => {
					this.login.gtoken = response.data.grant_token;
					this.get_atoken();
				})
				.catch(e => this.logs = e.response.data.errors);
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
						this.login.mail = response.data.email;
						this.isLogin = true;
						this.get_lists();
					}
				})
				.catch(e => {
					this.submit_content.message = "";
					this.isLogin = false;
					localStorage.removeItem("gtoken");
					localStorage.removeItem("atoken");
				})
		},

		//一覧を取得
		//IDを指定した場合は、対象IDのユーザーのメッセージだけを表示
		get_lists(member_id) {
			let filter = '';
			if(member_id) {
				filter = '?filter=member_id%20%3D%20' + member_id;
			}
			axios
				.get('https://test-ewm.g.kuroco.app/rcms-api/3/lists' + filter, {
					headers: {
						'x-rcms-api-access-token': this.login.atoken
					}
				})
				.then(response => {
					this.lists = response.data;
				})
				.catch(e => {
					this.logs = e;
				})
		},

		//メッセージを投稿。投稿後、自動で一覧を更新
		//画像アップロード完了後に投稿するため、async-awaitを設定
		async submit() {
			//画像が指定されている場合は画像をアップロード後、file_idを挿入
			let image = {};
			if(this.submit_content.image) {
				file_id = await this.upload_image(this.submit_content.image);
				image = {
					"file_id": file_id
				};
			}
			await axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/submit',
					{
						"subject": this.submit_content.message,
						"regular_flg": 0,
						"topics_flg": 1,
						"open_flg": 1,
						"ymd": new Date().toLocaleDateString('sv-SE'),
						"post_time": new Date().toLocaleTimeString('it-IT'),
						"author_id": {
							"module_type": "member",
							"module_id": this.login.member_id
						},
						"author_name": this.login.firstname + this.login.lastname,
						image
					},
					{
						headers: {
							'x-rcms-api-access-token': this.login.atoken
						}
					})
				.then(response => {
					this.submit_content = {};
					this.get_lists();
				})
				.catch(e => {
					this.logs = e.response.data.errors;
				})
		},
		//投稿する画像情報を取得
		select_image(file) {
			this.submit_content.image = file.target.files[0];
			if(this.submit_content.image) {
				this.submit_content.img_thumb_url = URL.createObjectURL(this.submit_content.image);
			} else {
				this.submit_content.img_thumb_url = "";
			}
		},
		//画像のアップロード
		//画像アップロード完了後に投稿するため、async-awaitを設定
		async upload_image(file) {
			let file_id = ''
			await axios
			.post('https://test-ewm.g.kuroco.app/rcms-api/3/img_upload',
				{
					"file": file
				},
				{
					headers: {
						'x-rcms-api-access-token': this.login.atoken,
						'Content-Type': 'multipart/form-data',
					}
				})
			.then(response => {
				file_id = response.data.file_id;
			})
			.catch(e => {
				return;
			})
			return file_id;
		},

		//自身の投稿したメッセージのみ削除機能
		//※API側では自身のコンテンツかどうかの判定はできない？JSのみの制御では悪用される可能性あり
		async delete_message(topics_id) {
			await axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/delete_message/'+topics_id, {},
					{
						headers: {
							'x-rcms-api-access-token': this.login.atoken
						}
					})
				.then(response => {
					this.get_lists();
				})
				.catch(e => this.logs = e.response.data.errors);
		},

		//お問合せモーダル
		modal_open() {
			document.getElementById('dialog').showModal()
			this.contact_content.status = "input";
			if(this.isLogin) {
				this.contact_content.mail = this.login.mail;
			}
		},
		modal_close() {
			document.getElementById('dialog').close()
			this.contact_content.res = "";
			this.contact_content.res_e = "";
		},
		confirm() {
			this.contact_content.status = "confirm";
		},
		contact() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/4/contact',
					{
						"name": (this.login.firstname+this.login.lastname) || "未入力",
						"email": this.contact_content.mail,
						"body": this.contact_content.form,
						"from_id": 0,
						"from_module": "string",
						"validate_only": false
					})
				.then(response => {
					this.contact_content.status = "thanks";
					this.contact_content.res = response;
				})
				.catch(e => {
					this.contact_content.res_e = e.response.data.errors;
				})
		},

		//ログアウト→プロフィールの再取得（取得失敗することで非ログイン状態を検知）
		do_logout() {
			axios
				.post('https://test-ewm.g.kuroco.app/rcms-api/3/logout', {},
					{
						headers: {
							'x-rcms-api-access-token': this.login.atoken
						}
					})
				.then(response => {
					this.isLogin = false;
				})
				.catch(e => this.logs = e);
			localStorage.removeItem("gtoken");
			localStorage.removeItem("atoken");
			this.get_profile();
		}
	},
	
	mounted() {
		//ローカルストレージにatoken情報があれば自動ログインを試行
		if (localStorage.getItem("atoken")) {
			this.login.gtoken = localStorage.getItem("gtoken");
			this.login.atoken = localStorage.getItem("atoken");
			this.get_profile();
		}
	}
}).mount("#app");