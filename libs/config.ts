import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    Category, SimpleCategory,
    MusicStyle, SimpleMusicStyle,
    Music, CategoryLoader,
} from './category';

class Config {
    username = "";
    password = "";
    email = "";
    volume = 50;
    categorys = new Array<Category>();

    static fromJSON(data: Object): Config {
        let config = new Config();
        config.username = data["username"];
        config.password = data["password"];
        config.email = data["email"];
        config.volume = data["volume"];
        data["categorys"].forEach(category => {
            config.categorys.push(SimpleCategory.fromJSON(category));
        });
        return config;
    }
}

export default class ConfigLoader implements CategoryLoader {
    _config_dir = path.join(os.homedir(), ".config/nineku.fm");
    _config_path = path.join(this._config_dir, "config.json");
    _encoding: BufferEncoding = "utf-8";
    _config: Config = null;

    constructor() {
    }

    getVolumn(): number {
        return this._config.volume;
    }

    setVolumn(volumn: number) {
        if (volumn >= 0 && volumn <= 150) {
            this._config.volume = volumn;
        }
    }

    async pushLikeStyle(music: Music) {
        (await this.getLikeStyle().getMusics()).push(music);
    }

    async pushHateStyle(music: Music) {
        (await this.getHateStyle().getMusics()).push(music);
    }

    getLikeStyle(): MusicStyle {
        return this._config.categorys[0].getStyles().find(
            style => style.getName() == "喜欢");
    }

    getHateStyle(): MusicStyle {
        return this._config.categorys[0].getStyles().find(
            style => style.getName() == "讨厌");
    }

    defaultConfig(): Config {
        let config = new Config();
        let category = new SimpleCategory("自定义");
        let like_style = new SimpleMusicStyle("喜欢");
        let hate_style = new SimpleMusicStyle("讨厌");
        category.getStyles().push(like_style, hate_style);
        config.categorys.push(category);
        return config;
    }

    async getCategories(): Promise<Array<Category>> {
        return this._config.categorys;
    }

    load(): boolean {
        if (!fs.existsSync(this._config_path)) {
            this._config = this.defaultConfig();
            return false;
        }
        let body: string = fs.readFileSync(this._config_path, this._encoding);
        this._config = Config.fromJSON(JSON.parse(body));
        return true;
    }

    save() {
        if (!fs.existsSync(this._config_dir)) {
            fs.mkdirSync(this._config_dir);
        }
        let body = JSON.stringify(this._config, null, 4);
        fs.writeFileSync(this._config_path, body, this._encoding);
    }

}
