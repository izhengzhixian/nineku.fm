import { UI, LineName, Key } from './ui';
import { Category, MusicStyle, Music } from './category';

import SoundPlayer from './sound_player';
import Timer from './timer';
import { Lyrics } from './lyrics';
import ConfigLoader from './config';
import { loadAllLoaders } from './loader';

function randomInt(n: number): number {
    return Math.floor((Math.random() * n));
}

function randomItems<T>(items: Array<T>, del=false): T {
    let idx = Math.floor((Math.random() * items.length));
    if (del) {
        return items.splice(idx, 1)[0];
    }
    return items[idx];
}

export default class Shell {
    _ui = new UI();
    _config: ConfigLoader = null;
    _categorys = new Array<Category>();
    _musics: Array<Music>;
    _player: SoundPlayer = null;
    _music: Music = null;
    _lyrics: Lyrics = null;
    _timer = new Timer();
    _category_index = 0;
    _style_index = 0;
    _category_pos = 0;
    _style_pos = 0;
    _volume = 50;
    _next = true;
    _music_index = 0;
    _daemon = false;

    constructor() {
        this._daemon = process.argv.indexOf("daemon") >= 0;
    }

    log(msg: any) {
        if (this._daemon) {
            console.log(msg);
        }
    }

    _musicCloseCallback() {
        this.log('closeCallback');
        if (this._player) {
            this.log('closeCallback clear');
            this.clearMusic();
        }
        if (this._next) {
            this.randomMusic();
            return;
        }
        this._next = true;
        if (this._musics.length == 0) {
            this.selectStyle();
        } else {
            this.selectStyle(this._category_pos, this._style_pos);
        }
    }

    loadConfig() {
        this._config = new ConfigLoader();
        if (!this._config.load()) {
            this._ui.setLineWithTimeout(
                LineName.TIP, "不存在配置文件, 使用默认配置文件");
        } else {
            this._ui.setLineWithTimeout(LineName.TIP, "加载配置成功");
        }
        this._volume = this._config.getVolumn();
    }

    run() {
        this._ui.setShow(!this._daemon);
        this._ui.setKeyPressCallback(key => this.keypress(key));
        this._ui.run(() => this.refreshUI());

        process.on('exit', (code: number) => {
            this._ui.close(code == 0);
        });

        this.loadCategory();
    }

    async loadCategory() {
        let loaders = await loadAllLoaders();
        this.loadConfig();
        loaders.push(this._config);
        for (let loader of loaders) {
            this._categorys.push(...(await loader.getCategories()));
        }
        await this.selectStyle();
    }

    async selectStyle(category_index=-1, style_index=-1) {
        if (category_index >= 0) {
            this._category_index = category_index;
        }
        if (style_index >= 0) {
            this._style_index = style_index;
        }
        if (this._categorys.length == 0) {
            this._ui.error("categorys length is 0");
            return;
        }
        let category = this._categorys[this._category_index];
        if (category.getStyles().length == 0) {
            this._ui.setLineWithTimeout(
                LineName.TIP,
                `分类<<${category.getName()}>>内风格个数为0, 将随机热门分类中一个风格`);
            this._categorys.splice(this._category_index, 1);
            this.randomStyle();
            return;
        }
        let style = category.getStyles()[this._style_index];
        await this.enterMusicStyle(style);
    }

    randomStyle() {
        // this._category_index = randomInt(this._categorys.length);
        this._category_index = 0;
        let category = this._categorys[this._category_index];
        this._style_index = randomInt(category.getStyles().length);
        this.selectStyle();
    }

    async enterMusicStyle(style: MusicStyle) {
        this._musics = await style.getMusics();
        if (this._musics.length == 0) {
            this._ui.setLineWithTimeout(
                LineName.TIP,
                `风格<<${style.getName()}>>内歌曲个数为0, 将随机热门分类中一个风格`);
            let category = this._categorys[this._category_index];
            if (style.allowRemove()) {
                category.getStyles().splice(this._style_index, 1);
            }
            this.randomStyle();
            return;
        }
        this.randomMusic();
    }

    randomMusic() {
        this.log('randomMusic');
        let music = randomItems(this._musics);
        this._music = music;
        this._loadMusic();
        this._loadLyrics();
    }

    async _loadLyrics() {
        this._lyrics = await this._music.getLyrics();
    }

    async _loadMusic() {
        this._player = new SoundPlayer(this.getVolume());
        if (this._music_index < 100) {
            this._player.setCloseCallback(() => {
                this._musicCloseCallback();
            });
        }
        this._music_index++;
        await this._player.load(this._music.getURI());
        if (this._player) {
            this.startMusic();
        }
    }

    startMusic() {
        if (this._player.start()) {
            this._timer.start();
            return;
        }
    }

    pauseMusic() {
        if (this._player.pause()) {
            this._timer.stop();
            return;
        }
    }

    clearMusic() {
        this.log('clearMusic');
        let player = this._player;
        this._player = null;
        this._music = null;
        this._timer.reset();
        this._lyrics = null;
        if (player) {
            this._volume = player.getVolume();
            this.log('playClose');
            player.close();
        }
    }

    getVolume() {
        if (this._player) {
            this._volume = this._player.getVolume();
            if (this._config) {
                this._config.setVolumn(this._volume);
            }
        }
        return this._volume;
    }

    saveConfig() {
        if (this._config) {
            this._config.save();
        }
    }

    keypress(key: Key) {
        if (key.ctrl && key.name == "c") {
            process.exit(0);
        }
        if (key.ctrl) {
            return;
        }
        if (key.name == "space") {
            if (!this._player) {
                return;
            }
            if (this._player.isPlay()) {
                this.pauseMusic();
            } else {
                this.startMusic();
            }
        } else if (key.name == "q") {
            this.saveConfig();
            process.exit(0);
        } else if (key.name == ">" || key.name == ".") {
            if (this._player) {
                this._player.upVolume();
            }
        } else if (key.name == "<" || key.name == ",") {
            if (this._player) {
                this._player.downVolume();
            }
        } else if (key.name == "n") {
            this._next = true;
            this.clearMusic();
        } else if (key.name == "j" || key.name == "up") {
            this._category_pos += (this._categorys.length - 1);
            this._category_pos %= this._categorys.length;
            this._style_pos = 0;
        } else if (key.name == "k" || key.name == "down") {
            this._category_pos++;
            this._category_pos %= this._categorys.length;
            this._style_pos = 0;
        } else if (key.name == "h" || key.name == "left") {
            this._style_pos--;
            if (this._style_pos < 0) {
                this._style_pos += this._categorys[this._category_pos]
                    .getStyles().length;
            }
        } else if (key.name == "l" || key.name == "right") {
            this._style_pos++;
            this._style_pos %= this._categorys[this._category_pos]
                .getStyles().length;
        } else if (key.name == "return") {
            this._next = false;
            this.clearMusic();
        } else if (key.name == "s") {
            if (this._music) {
                this._config.pushLikeStyle(this._music);
            }
        } else if (key.name == "t") {
            if (this._music) {
                this._config.pushHateStyle(this._music);
                this.clearMusic();
            }
        } else if (key.name == "d") {
            let index = this._musics.indexOf(this._music);
            if (index < 0) {
                this.setTip("从当前风格删除歌曲失败");
            } else {
                this._musics.splice(index, 1);
                this.setTip("从当前风格删除歌曲成功");
                this.clearMusic();
            }
        }
    }

    setTip(data: string) {
        this._ui.setLine(LineName.TIP, data);
    }

    refreshUI() {
        this._ui.setArrayLine(
            LineName.CATEGORY,
            this._categorys.map(category => {
                return category.getName();
            }), this._category_index,
            this._category_pos);
        let category = this._categorys[this._category_pos];
        let styles = (category && category.getStyles())
            || new Array<MusicStyle>();
        this._ui.setArrayLine(
            LineName.STYLE,
            styles.map(style => {
                return style.getName();
            }), this._category_index == this._category_pos
                ? this._style_index : -1,
            this._style_pos);
        this._ui.setLine(
            LineName.MUSIC_NAME,
            (this._music && this._music.getName()) || "");
        this._ui.setLine(
            LineName.SONG_NAME,
            (this._music && this._music.getSong()) || "");
        this._ui.setLine(
            LineName.ALBUM_NAME,
            (this._music && this._music.getAlbum()) || "");
        this._ui.setLine(
            LineName.VOLUME,
            String(this.getVolume()) + "%");
        this._ui.setLine(
            LineName.TIME, this._timer.show() + "/"
                + this._timer.show((this._music
                    && this._music.getTime() * 1000) || 0));
        let lyric_index = (this._lyrics &&
            this._lyrics
                .getLyricLineIndexWithTime(this._timer.getPlayTime()))
            || -1;
        if (lyric_index < 0) {
            this._ui.clearLRC();
        } else {
            this._ui.setLRC(this._lyrics.getLyricLine(), lyric_index-2);
        }
    }
}
