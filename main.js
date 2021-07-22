const fetch = require("node-fetch");
const readline = require("readline");
const fs = require("fs").promises;
const logUpdate = require("log-update");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

let output = [];
let backup = {
	likes: [],
	playlists: [],
	comments: []
};

let state = {
	likes: {
		max: 0,
		finishedCount: 0,
		currentName: ""
	},
	playlists: {
		max: 0,
		finishedCount: 0,
		currentName: ""
	},
	playlistSongs: {
		max: 0,
		finishedCount: 0,
		currentName: ""
	},
	comments: {
		max: 0,
		finishedCount: 0,
		currentName: ""
	}
}

async function askTrueFalse(question){
	return await ask(question) === "はい";
}

const ask = (question) => new Promise(resolve => {
	rl.question(question, input => resolve(input));
});

const getEndpointUrl = (endpointName, isNew=false) => isNew ? `https://api-flmg.eggs.mu/v1/${endpointName}` : `https://api.eggs.mu/api/v2/${endpointName}`;

const generateRandomHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

const printFromState = (stateObject) => { logUpdate(`${stateObject.finishedCount} / ${stateObject.max} (${stateObject.currentName})`) };

function emit(data) {
	
	output.push(data);

	switch(data.type) {
		case "display":
			logUpdate.done()
			logUpdate(data.message);
			logUpdate.done()
			break;

		case "warning":
			logUpdate("WARNING: ", data.message);
			logUpdate.done();
			break;
		
		case "error":
			logUpdate.done();
			logUpdate("ERROR:");
			logUpdate.done();
			console.log(data.message);

		case "totalLikes":
			logUpdate("Like");
			logUpdate.done();
			state.likes.max = data.message;
			printFromState(state.likes);
			break;

		case "likeInProgress":
			state.likes.currentName = data.message;
			printFromState(state.likes);
			break;

		case "currLikes":
			state.likes.finishedCount = data.message;
			printFromState(state.likes);
			break;

		case "totalPlaylists":
			logUpdate.done();
			logUpdate("プレイリスト");
			logUpdate.done();
			state.playlists.max = data.message;
			printFromState(state.playlists);
			break;

		case "playlistInProgress":
			state.playlists.currentName = data.message;
			printFromState(state.playlists);
			logUpdate.done();
			break;

		case "currPlaylists":
			state.playlists.finishedCount = data.message;
			printFromState(state.playlists);
			break;

		case "totalPlaylistSongs":
			state.playlistSongs.max = data.message;
			printFromState(state.playlistSongs);
			break;

		case "playlistSongInProgress":
			state.playlistSongs.currentName = data.message;
			printFromState(state.playlistSongs);
			break;

		case "currPlaylistSongs":
			state.playlistSongs.finishedCount = data.message;
			printFromState(state.playlistSongs);
			break;

		case "totalPushes":
			logUpdate("Push");
			logUpdate.done();
			state.comments.max = data.message;
			printFromState(state.comments);
			break;

		case "pushInProgress":
			state.comments.currentName = data.message;
			printFromState(state.comments);
			break;

		case "currPushes":
			state.comments.finishedCount = data.message;
			printFromState(state.comments);
			break;
		
	}

}

// sleeps are implemented to try not to accidentally DDOS eggs.mu
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class DataMigrator {

	constructor(id, password, migratePlaylist, migrateLike, migratePush) {
		this.id = id;
		this.password = password;
		this.deviceId = generateRandomHex(16);
		this.deviceName = "SM-G977N";
		this.prefix = "復旧した";
		this.songs = {};
		this.isMigratingPlaylists = migratePlaylist;
		this.isMigratingLikes = migrateLike;
		this.isMigratingPushes = migratePush;
	}

	getUserEndpoint = (endpointName) => `members/${this.memberId}/${endpointName}`;

	async executePostRequest(endpointName, body, isNew=false) {
		const stringifiedBody = JSON.stringify(body);
		let options = {
			method: "POST",
			headers: {
				"User-Agent": isNew ? "flamingo/7.0.00 (Android; 7.1.2)" : "eggsapp/6.0.04 (Linux; U; Android 7.1.2; jp; SM-G977N Build/LMY48Z)",
				"Content-Length": stringifiedBody.length,
				"Content-Type": "application/json; charset=utf-8"
			},
			body: stringifiedBody
		}
	
		if (isNew) {
			options.headers.deviceId = this.deviceId;
			options.headers.deviceName = this.deviceName;
			options.headers.apVersion = "7.0.00";

			if (this.newAccessToken) {
				options.headers.Authorization = `Bearer ${this.newAccessToken}`;
			}
		}
	
		return await (await fetch(getEndpointUrl(endpointName, isNew), options)).json()
	}

	isYoutube(song, isNew) {
		if (isNew) {
			return song.youtubeUrl !== null;
		} else {
			return song.musicType === 2;
		}
	}

	async executePutRequest(endpointName, body) {
		const stringifiedBody = JSON.stringify(body);
		let options = {
			method: "PUT",
			headers: {
				"User-Agent": "flamingo/7.0.00 (Android; 7.1.2)",
				"Content-Length": stringifiedBody.length,
				"Content-Type": "application/json; charset=utf-8",
				deviceId: this.deviceId,
				deviceName: this.deviceName,
				apVersion: "7.0.00",
				Authorization: `Bearer ${this.newAccessToken}`
			},
			body: stringifiedBody
		}
		return await (await fetch(getEndpointUrl(endpointName, true), options)).json()
	}

	async executeGetRequest(endpointName, body={}, isNew=false) {
		if (!isNew) {
			body.accessToken = this.accessToken;
		}
		const queryString = new URLSearchParams(body).toString();

		let options = {};
		if (isNew) {
			options.headers = {
				Authorization: `Bearer ${this.newAccessToken}`,
				deviceId: this.deviceId,
				deviceName: this.deviceName,
				apVersion: "7.0.00",
				"User-Agent": "flamingo/7.0.00 (Android; 7.1.2)"
			}
		}

		return await (await fetch(`${getEndpointUrl(endpointName, isNew)}${queryString ? `?${queryString}` : ""}`, options)).json();
	}

	async authenticate() {

		const unauthenticatedToken = (await this.executePostRequest("token", {
			appVersion: "7.0.00",
			deviceCd: "android",
			deviceName: this.deviceName
		})).data.accessToken;
	
		const { accessToken, memberInfo: { name, memberId } } = (await this.executePostRequest("auth/login", {
			accessToken: unauthenticatedToken,
			authType: "1",
			id: this.id,
			password: this.password
		})).data;

		this.accessToken = accessToken;
		this.memberId = memberId;
		this.username = name;
		emit({type: "display", message: `${name}として旧Eggsにログインしました`});
		return this;

	}

	async paginateRequest(url) {
		let res = (await this.executeGetRequest(url)).data.lists[0];
		let { items } = res;
		while (res.nextToken) {
			res = (await this.executeGetRequest(url, {
				nextToken: res.nextToken
			})).data.lists[0];
			items.push(...res.items);
			await sleep(2000);
		}
		return items;
	}

	async fetchData() {

		if (this.isMigratingPlaylists) {
			this.playlists = await this.paginateRequest(this.getUserEndpoint("playlists"));
			emit({type: "display", message: `プレイリストを${this.playlists.length}見つけました：\n${this.playlists.map(playlist => playlist.playlistName).join("\n")}`});
		}

		if (this.isMigratingLikes) {
			this.likes = await this.paginateRequest(this.getUserEndpoint("likes"));
			emit({type: "display", message: `Likeしたトラックを${this.likes.length}見つけました`});
		}

		if (this.isMigratingPushes) {
			this.pushes = await this.paginateRequest(this.getUserEndpoint("shares"));
			emit({type: "display", message: `Pushしたトラックを${this.pushes.length}見つけました`});
		}

	}

	async newLogin() {
		({access_token: this.newAccessToken} = await this.executePostRequest("auth/auth/login", {
			loginId: this.id,
			password: this.password,
			type: "1"
		}, true));

		const { data: { displayName } } = await this.executeGetRequest("users/users/profile", {}, true);
		emit({type: "display", message: `${displayName}として新Eggsにログインしました`});
	}

	async likeSong(id) {
		const { data: [{ isLike: isLiked }]} = await this.executeGetRequest("evaluation/evaluation/musics/like_info", {
			musicIds: id
		}, true);
		if (!isLiked) {
			await this.executePostRequest(`evaluation/evaluation/musics/${id}/like`, {}, true);
		}
		backup.likes.push(id);
	}

	async getSongData(song) {

		// cache responses
		if (!(this.songs.hasOwnProperty(song.artistNameEn))) {
			this.songs[song.artistNameEn] = {};
		}
		if (!(this.songs[song.artistNameEn].hasOwnProperty(song.musicName))) {
			this.songs[song.artistNameEn][song.musicName] = {};
		}
		if (!(this.songs[song.artistNameEn][song.musicName].hasOwnProperty(song.musicType.toString()))) {
			const res = await this.executeGetRequest(`artists/artists/${song.artistNameEn}/musics`, {}, true);

			if (res.code === "E404001") {
				emit({type: "warning", message: `${song.artistName}：${res.message}`});
				this.songs[song.artistNameEn][song.musicName][song.musicType.toString()] = { musicId: null, artistId: null };
			} else {
				const [{ musicId, artistData: { artistId }}] = res.data.filter(track => track.musicTitle === song.musicName)
					.sort((a,b) => Number(this.isYoutube(b, true) === this.isYoutube(song, false)) - Number(this.isYoutube(a, true) === this.isYoutube(song, false)));
				this.songs[song.artistNameEn][song.musicName][song.musicType.toString()] = { musicId, artistId };
			}

			await sleep(2000);
		}

		return this.songs[song.artistNameEn][song.musicName][song.musicType.toString()];
	}

	async likeSongs() {
		emit({type: "totalLikes", message: this.likes.length});
		let i = 1;
		for (let likedSong of this.likes) {
			emit({type: "likeInProgress", message: `「${likedSong.musicName}」${likedSong.artistName}`});
			const { musicId: likedSongId } = await this.getSongData(likedSong);
			if (likedSongId !== null) {
				await this.likeSong(likedSongId);
			}
			await sleep(2000);
			emit({type: "currLikes", message: i++});
		}
	}

	async populatePlaylist(oldPlaylistId, newPlaylistId, newPlaylistName) {
		const oldPlaylistContent = (await this.paginateRequest(`members/playlists/${oldPlaylistId}`)).map(song => ({ artistName: song.artistName, musicType: song.musicType, artistNameEn: song.artistNameEn, musicName: song.musicName }));
		let newPlaylistContent = [];
		emit({type: "totalPlaylistSongs", message: oldPlaylistContent.length});
		let i = 1;
		for (let song of oldPlaylistContent) {
			emit({type: "playlistSongInProgress", message: `「${song.musicName}」${song.artistName}`});
			const songData = await this.getSongData(song);
			if (songData.artistId !== null) {
				newPlaylistContent.push(songData);
				backup.playlists[0].songs.push(songData);
			}
			emit({type: "currPlaylistSongs", message: i++});
		}

		await this.executePutRequest("/playlists/playlists", {
			arrayOfArtistId: newPlaylistContent.map(song => song.artistId).join(","),
			arrayOfMusicId: newPlaylistContent.map(song => song.musicId).join(","),
			isPrivate: 1,
			playlistId: newPlaylistId,
			playlistName: newPlaylistName
		});
		
	}

	async createPlaylists() {
		emit({type: "totalPlaylists", message: this.playlists.length});
		let i = 1;
		for (let playlist of this.playlists) {
			emit({type: "playlistInProgress", message: playlist.playlistName});
			const { data: [ { playlistId: newPlaylistId, playlistName: newPlaylistName } ] } = await this.executePostRequest("playlists/playlists", {
				isPrivate: 1,
				playlistName: `${this.prefix}${playlist.playlistName}`
			}, true);
			backup.playlists.unshift({
				title: newPlaylistName,
				songs: []
			});
			await this.populatePlaylist(playlist.playlistId, newPlaylistId, newPlaylistName);
			await sleep(2000);
			emit({type: "currPlaylists", message: i++});
		}
	}

	async shouldCommentOnSong(id, comment) {
		if (comment.trim() === "") {
			return false;
		}

		const comments = (await this.executeGetRequest(`evaluation/evaluation/musics/${id}/comments`, {}, true)).data;
		if (!comments.some(comment => comment.displayName === this.username || comment.userName === this.username)) {
			return false;
		}

		return true;
	}

	async commentOnSong(id, comment, postTime) {
		if (!this.shouldCommentOnSong(id, comment)) {
			emit({type: "warning", message: "コメントをしませんでした。Pushは空だったか、もう新Eggsにコメントをしました"})
		}
		await this.executePostRequest(`evaluation/evaluation/musics/${id}/comments`, {comment: `「${postTime}のPushから復旧した」${comment}`}, true);
		backup.comments.push({
			id,
			comment: `「${postTime}のPushから復旧した」${comment}`
		});
	}

	async commentOnSongs() {
		emit({type: "totalPushes", message: this.pushes.length});
		let i = 0;
		for (let pushedSong of this.pushes) {
			emit({type: "pushInProgress", message: pushedSong});
			const { musicId: pushedSongId } = await this.getSongData(pushedSong);
			if (likedSongId !== null) {
				await this.commentOnSong(pushedSongId, pushedSong.message, pushedSong.postTime);
			}
			await sleep(2000);
			emit({type: "currPushes", message: ++i});
		}
	}

}

async function main() {

	let dataMigrator = new DataMigrator(
		await ask("Eggs IDまたはメールアドレスを入力してください："),
		await ask("パスワードを入力してください："),
		await askTrueFalse("プレイリストを復旧したいですか？（はい / いいえ）："),
		await askTrueFalse("Likeを復旧したいですか？（はい / いいえ）："),
		await askTrueFalse(`もうTimelineがないのでPushすることは不可能であります。
代わりに、Pushのメセージをコメントまで復旧できます。
03/10 04:59のメセージは「最高！」だったPush　→　「「03/10 04:59のPushから復旧した」最高！」をコメントをします。
Pushはコメントに復旧したいですか？（はい / いいえ）：`));
	try {
		await dataMigrator.authenticate();
		await dataMigrator.fetchData();
		await dataMigrator.newLogin();

		if (dataMigrator.isMigratingPlaylists) {
			await dataMigrator.createPlaylists();
		}

		if (dataMigrator.isMigratingLikes) {
			await dataMigrator.likeSongs();
		}
		
		if (dataMigrator.isMigratingPushes) {
			await dataMigrator.commentOnSongs();
		}
		logUpdate.done();
		logUpdate("ログを書きます");
		await fs.writeFile("log.json", JSON.stringify(output));
		logUpdate.done();
		logUpdate("バックアップを書きます");
		await fs.writeFile("backup.json", JSON.stringify(output));
		logUpdate.done();
		logUpdate("終わりました！");
		
	} catch(err) {
		emit({ type: "error", message: err });
	}
	
}

main();
