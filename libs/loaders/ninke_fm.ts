import { Category, MusicStyle, Music,
         CategoryLoader, SimpleCategory, registerMusicLoader } from '../category';
import { Lyrics } from '../lyrics';
import { node_fetch as fetch } from '../fetch';

import * as cheerio from "cheerio";


class NinekuLyrics extends Lyrics {
    modifyData(data: string): string {
        let items = data.split("$song_Lrc");
        return items[1];
    }
}

let COMPONETN_NAME = "nineku.fm";

class NinekuMusic extends Music {
    _data: any;
    _lyrics: Lyrics;
    constructor(data: any) {
        super();
        this._data = data;
    }

    serialization(): Object {
        return this._data;
    }

    componentName(): string {
        return COMPONETN_NAME;
    }

    getTime() {
        return this._data["mp3time"];
    }

    getSize() {
        return this._data["mp3size"];
    }

    getName(): string {
        return this._data["gqname"];
    }

    getSong(): string {
        return this._data["gsname"];
    }

    getAlbum(): string {
        return this._data["zjname"];
    }

    async getLyrics(): Promise<Lyrics> {
        this._lyrics = new NinekuLyrics();
        let lrc_group_id = Math.floor(this._data["gqid"] / 10000) + 1;
        let gqid = this._data["gqid"];
        let lrc = `http://www.9ku.com/html/lrc/${lrc_group_id}/${gqid}.js`;
        await this._lyrics.loadURL(lrc);
        return this._lyrics;
    }

    getURI(): string {
        return this._data["mp3"];
    }
};

class NinekuMusicStyle extends MusicStyle {
    _name = "";
    _link = "";
    _musics = new Array<Music>();
    _load = false;

    constructor(name: string, link: string) {
        super();
        this._name = name;
        this._link = link;
    }

    getName(): string {
        return this._name;
    }

    async getMusics(): Promise<Array<Music>> {
        if (!this._load) {
            this._load = true;
            let resp = await fetch(this._link);
            let text = await resp.text();
            let music_list = JSON.parse(text.slice(24, -17));
            music_list.forEach(item => {
                this._musics.push(new NinekuMusic(item));
            });
        }
        return this._musics;
    }
}

export default class Loader implements CategoryLoader {
    _categorys = new Array<Category>();
    _style2musics = new Map<string, Array<Music>>();

    constructor() {
    }

    async getCategories(): Promise<Array<Category>> {
        let url = "http://www.9ku.com/fm/";
        let resp = await fetch(url);
        let $ = cheerio.load(await resp.buffer());
        let fenge_head = $("ul.fmNav.clearfix li a");
        fenge_head.each((index, elem: cheerio.TagElement) => {
            let name = elem.children[0].data;
            this._categorys.push(new SimpleCategory(name));
        });
        let fenlei = $('.fmMhzBox ul');
        fenlei.each((index, elem: cheerio.TagElement) => {
            let category = this._categorys[index];
            elem.children.forEach((child: cheerio.TagElement) => {
                if (child.type != "tag") {
                    return;
                }
                let name = (<cheerio.TagElement>(<cheerio.TagElement>child
                    .children[1]).children[3]).children[0].data;
                let data_id = child.attribs["data-id"];
                let link = `http://www.9ku.com/fm/fenge/${data_id}.js`;
                category.getStyles().push(new NinekuMusicStyle(name, link));
            });
        });
        return this._categorys;
    }

}

function NinekuMusicLoader(data: Object): Music {
    return new NinekuMusic(data);
}

registerMusicLoader(COMPONETN_NAME, NinekuMusicLoader);
